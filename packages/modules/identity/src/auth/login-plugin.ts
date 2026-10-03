// Chaku's additions to Better Auth's email login (D32, D56, ADR-0010):
// - the link in the login email: a single-use token stored hashed, expiring with the code, that
//   logs in through `POST /sign-in/email-link`. Logging in either way voids the other;
// - the guard on sending a code: the bot check (D44) and the D56 limits per address and per IP;
// - the deletion grace flag on the login response (D5).
import { createHash, randomBytes } from 'node:crypto';

import type { BotCheck } from '@chaku/adapters/bot-check';
import type { RateLimiter } from '@chaku/adapters/rate-limit';
import type { BetterAuthPlugin, GenericEndpointContext } from 'better-auth';
import { createAuthEndpoint, createAuthMiddleware, getIP, isAPIError } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { parseUserOutput } from 'better-auth/db';
import { z } from 'zod';

import { botCheckFailed, invalidLink, rateLimited, unsupportedCodeType } from './errors.ts';
import type { LoginLimits } from './limits.ts';

const linkPrefix = 'email-link-';

/** Better Auth's identifier for a sign-in code (its email OTP plugin's `toOTPIdentifier`). */
const signInCodeIdentifier = (email: string) => `sign-in-otp-${email}`;

const linkIdentifier = (token: string) =>
  `${linkPrefix}${createHash('sha256').update(token).digest('base64url')}`;

/** The header the login screen puts the bot check's token in. */
export const botCheckHeader = 'x-bot-check-token';

/** A cookie for the deletion grace banner when the login ends in a redirect (Google). */
export const deletionCancelledCookie = 'chaku_deletion_cancelled';

/** Deletes the unused link tokens of an address. */
async function voidLinks(ctx: GenericEndpointContext, email: string): Promise<void> {
  await ctx.context.adapter.deleteMany({
    model: 'verification',
    where: [
      { field: 'value', value: email },
      { field: 'identifier', operator: 'starts_with', value: linkPrefix },
    ],
  });
}

/**
 * Makes the link token for a login email and returns it. Only its hash is stored, and an older
 * link to the same address stops working, as an older code does.
 */
export async function createLoginLink(
  ctx: GenericEndpointContext,
  email: string,
  lifetimeSeconds: number,
): Promise<string> {
  await voidLinks(ctx, email);
  const token = randomBytes(32).toString('base64url');
  await ctx.context.internalAdapter.createVerificationValue({
    identifier: linkIdentifier(token),
    value: email,
    expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
  });
  return token;
}

/** The paths that end in a new session from a sign-in (not every path that creates one). */
const signInPaths = new Set([
  '/sign-in/email-otp',
  '/sign-in/email-link',
  '/callback/:id',
  '/sign-in/social',
  '/passkey/verify-authentication',
]);

export interface LoginPluginOptions {
  limits: LoginLimits;
  rateLimiter: RateLimiter;
  botCheck: BotCheck;
}

export function chakuLogin({ limits, rateLimiter, botCheck }: LoginPluginOptions) {
  const consumeCodeLimits = async (ctx: GenericEndpointContext, address: string) => {
    const ip = getIP(ctx.request ?? ctx.headers ?? new Headers(), ctx.context.options) ?? 'unknown';
    const result = await rateLimiter.consume([
      { limit: limits.codesPerAddressShort, key: address },
      { limit: limits.codesPerAddressDay, key: address },
      { limit: limits.codesPerIp, key: ip },
    ]);
    if (!result.allowed) throw rateLimited(result.retryAfter);
  };

  return {
    id: 'chaku-login',
    endpoints: {
      signInEmailLink: createAuthEndpoint(
        '/sign-in/email-link',
        { method: 'POST', body: z.object({ token: z.string().min(1).max(200) }) },
        async (ctx) => {
          const consumed = await ctx.context.internalAdapter.consumeVerificationValue(
            linkIdentifier(ctx.body.token),
          );
          if (!consumed || consumed.expiresAt < new Date()) throw invalidLink();
          const email = consumed.value;
          // The code in the same email is void too: one email, one login.
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(
            signInCodeIdentifier(email),
          );

          const found = await ctx.context.internalAdapter.findUserByEmail(email);
          // An unknown address goes through user creation, which refuses it until Invites
          // arrive (CHK-21), as a code login does.
          const user =
            found?.user ??
            (await ctx.context.internalAdapter.createUser(
              { email, emailVerified: true, name: '' },
              { method: 'magic-link' },
            ));
          if (!user.emailVerified) {
            await ctx.context.internalAdapter.updateUser(user.id, { emailVerified: true });
          }
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({
            token: session.token,
            user: parseUserOutput(ctx.context.options, user),
          });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === '/email-otp/send-verification-otp',
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as { email?: unknown; type?: unknown };
            // Codes for email verification and password resets have no use here (no passwords).
            if (body.type !== 'sign-in') throw unsupportedCodeType();
            const ip = getIP(ctx.request ?? ctx.headers ?? new Headers(), ctx.context.options);
            const token = ctx.headers?.get(botCheckHeader) ?? undefined;
            if (!(await botCheck.verify({ token, ip: ip ?? undefined }))) throw botCheckFailed();
            await consumeCodeLimits(
              ctx,
              typeof body.email === 'string' ? body.email.toLowerCase() : '',
            );
          }),
        },
        {
          // An email change code goes to the new address: the same limits for that address.
          matcher: (ctx) => ctx.path === '/email-otp/request-email-change',
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as { newEmail?: unknown };
            await consumeCodeLimits(
              ctx,
              typeof body.newEmail === 'string' ? body.newEmail.toLowerCase() : '',
            );
          }),
        },
      ],
      after: [
        {
          // A code login voids the link in the same email.
          matcher: (ctx) => ctx.path === '/sign-in/email-otp',
          handler: createAuthMiddleware(async (ctx) => {
            const email = ctx.context.newSession?.user.email;
            if (email) await voidLinks(ctx, email);
          }),
        },
        {
          // The session hook already set the Member back to `active`; the user object in the
          // response was read before that, so it still says `deletion_requested`.
          matcher: (ctx) => signInPaths.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const user = ctx.context.newSession?.user as { status?: unknown } | undefined;
            if (user?.status !== 'deletion_requested') return;
            ctx.setCookie(deletionCancelledCookie, '1', {
              path: '/',
              maxAge: 300,
              httpOnly: true,
              sameSite: 'lax',
              secure: ctx.context.options.advanced?.useSecureCookies ?? false,
            });
            const returned = ctx.context.returned;
            if (
              returned &&
              typeof returned === 'object' &&
              !(returned instanceof Response) &&
              !isAPIError(returned) &&
              'user' in returned
            ) {
              const body = returned as { user: object };
              return ctx.json({
                ...body,
                user: { ...body.user, status: 'active' },
                deletionCancelled: true,
              });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
