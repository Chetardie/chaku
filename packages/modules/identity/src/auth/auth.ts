// Better Auth in the identity module (ADR-0004, ADR-0010, D21, D32, D37). It stores everything in
// identity's own tables through the Drizzle adapter: Better Auth's models and fields are renamed
// onto ours, and the database makes the IDs (`uuidv7()`). The web app mounts `auth.handler` at
// /api/auth and reads sessions with `auth.api.getSession`.
import { passkey } from '@better-auth/passkey';
import type { BotCheck } from '@chaku/adapters/bot-check';
import type { EmailSender } from '@chaku/adapters/email';
import type { Logger } from '@chaku/adapters/log';
import type { RateLimiter } from '@chaku/adapters/rate-limit';
import { addJob, type Database, transaction } from '@chaku/db';
import { betterAuth, type GenericEndpointContext } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { eq } from 'drizzle-orm';

import { type EmailLocale, isEmailLocale } from '../emails/messages.ts';
import { emailChangeCodeEmail, loginCodeEmail } from '../emails/templates.ts';
import { emailChangeAlert } from '../jobs.ts';
import { accounts, emailChanges, members, passkeys, sessions, verifications } from '../schema.ts';
import {
  deviceCookieMaxAge,
  deviceCookieName,
  deviceLabel,
  newDeviceToken,
  recordLoginDevice,
} from './devices.ts';
import { banError, signupClosed } from './errors.ts';
import { chakuLogin, createLoginLink } from './login-plugin.ts';
import { type LoginLimits, loginLimits } from './limits.ts';

/** How a session logged in (D47: Admin tools need `passkey`). */
export const authMethods = ['google', 'email_code', 'email_link', 'passkey'] as const;
export type AuthMethod = (typeof authMethods)[number];

/** The endpoint a session is created in says how the Member logged in. */
const authMethodByPath: Record<string, AuthMethod> = {
  '/sign-in/email-otp': 'email_code',
  '/sign-in/email-link': 'email_link',
  '/callback/:id': 'google',
  '/sign-in/social': 'google',
  '/passkey/verify-authentication': 'passkey',
  '/passkey/verify-registration': 'passkey',
};

/**
 * Better Auth endpoints that stay off over HTTP. No passwords (ADR-0004); profile changes go
 * through oRPC with our own checks; session listing and revoking are oRPC procedures that never
 * hand out other sessions' tokens; and Google's tokens stay on the server.
 */
const disabledPaths = [
  '/sign-up/email',
  '/sign-in/email',
  '/change-password',
  '/set-password',
  '/verify-password',
  '/request-password-reset',
  '/reset-password',
  '/forget-password/email-otp',
  '/email-otp/request-password-reset',
  '/email-otp/reset-password',
  '/email-otp/verify-email',
  '/email-otp/check-verification-otp',
  '/send-verification-email',
  '/verify-email',
  '/change-email',
  '/update-user',
  '/delete-user',
  '/delete-user/callback',
  '/update-session',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/get-access-token',
  '/refresh-token',
  '/account-info',
];

export interface AuthConfig {
  /** `APP_URL`: Better Auth's base URL and the passkey origin (ADR-0010: every origin from env). */
  appUrl: string;
  /** `BETTER_AUTH_SECRET`: signs cookies and encrypts what Better Auth encrypts. */
  secret: string;
  /** `PASSKEY_RP_ID`: the apex app domain, which passkeys are bound to (D41). */
  passkeyRpId: string;
  /** Google login, only when both keys are set (D32: none in previews). */
  google?: { clientId: string; clientSecret: string } | undefined;
  limits?: LoginLimits;
}

export interface AuthDependencies {
  db: Database;
  email: EmailSender;
  rateLimiter: RateLimiter;
  botCheck: BotCheck;
  log: Pick<Logger, 'level' | 'debug' | 'info' | 'warn' | 'error'>;
  /** The language of a request, for login emails to addresses that belong to no Member. */
  requestLocale: (headers: Headers | undefined) => EmailLocale;
}

function requestHeaders(ctx: GenericEndpointContext | null | undefined): Headers | undefined {
  return ctx?.headers ?? ctx?.request?.headers;
}

/** Better Auth's log level for ours: it has no trace or fatal. */
function betterAuthLevel(level: string): 'debug' | 'info' | 'warn' | 'error' {
  if (level === 'trace' || level === 'debug') return 'debug';
  if (level === 'info' || level === 'warn') return level;
  return 'error';
}

export function createAuth(deps: AuthDependencies, config: AuthConfig) {
  const { db, log } = deps;
  const limits = config.limits ?? loginLimits;
  const appOrigin = new URL(config.appUrl).origin;
  const secureCookies = appOrigin.startsWith('https:');

  const memberLocale = async (email: string, ctx: GenericEndpointContext | undefined) => {
    const [member] = await db
      .select({ locale: members.locale })
      .from(members)
      .where(eq(members.email, email));
    return isEmailLocale(member?.locale) ? member.locale : deps.requestLocale(requestHeaders(ctx));
  };

  return betterAuth({
    baseURL: config.appUrl,
    secret: config.secret,
    trustedOrigins: [appOrigin],
    telemetry: { enabled: false },
    // Better Auth's log lines go through ours, without their extra arguments: those can hold
    // request data. Errors keep their message and stack.
    logger: {
      level: betterAuthLevel(log.level),
      log: (level, message, ...args) => {
        const err = args.find((arg) => arg instanceof Error);
        log[level](err ? { err } : {}, `better-auth: ${message}`);
      },
    },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { members, sessions, accounts, verifications, passkeys },
    }),
    advanced: {
      database: { generateId: false },
      cookiePrefix: 'chaku',
      useSecureCookies: secureCookies,
    },
    emailAndPassword: { enabled: false },
    disabledPaths,
    user: {
      modelName: 'members',
      fields: { name: 'displayName', image: 'providerImageUrl' },
      additionalFields: {
        role: { type: 'string', input: false, required: false, defaultValue: 'member' },
        banned: { type: 'boolean', input: false, required: false, defaultValue: false },
        banExpires: { type: 'date', input: false, required: false },
        status: { type: 'string', input: false, required: false, defaultValue: 'onboarding' },
        locale: { type: 'string', input: false, required: false },
      },
    },
    session: {
      modelName: 'sessions',
      fields: { userId: 'memberId' },
      expiresIn: 30 * 24 * 60 * 60,
      // Extended at most once a day while in use (D21).
      updateAge: 24 * 60 * 60,
      // Every request reads the session row, so revoking one ends it at once.
      cookieCache: { enabled: false },
      additionalFields: {
        authMethod: { type: 'string', input: false, required: false },
        loginDeviceId: { type: 'string', input: false, required: false },
      },
    },
    account: {
      modelName: 'accounts',
      fields: { userId: 'memberId' },
      // The same verified address through Google and email is one Member (D37).
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: { modelName: 'verifications' },
    rateLimit: {
      // D56's limits own the code-sending endpoints (login-plugin.ts); Better Auth's own limiter
      // (production only) keeps the rest.
      customRules: {
        '/email-otp/send-verification-otp': false,
        '/email-otp/request-email-change': false,
      },
    },
    ...(config.google
      ? {
          socialProviders: {
            google: {
              clientId: config.google.clientId,
              clientSecret: config.google.clientSecret,
              // A Display Name is at most 50 characters (D58); signup asks for one anyway.
              mapProfileToUser: (profile: { name?: string }) => ({
                name: (profile.name ?? '').slice(0, 50),
              }),
            },
          },
        }
      : {}),
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: limits.codeLifetimeSeconds,
        allowedAttempts: limits.wrongAttemptsPerCode,
        storeOTP: 'hashed',
        changeEmail: { enabled: true },
        // Sent from the request, not a job, so the code never sits in the queue (D9).
        async sendVerificationOTP({ email, otp, type }, ctx) {
          if (!ctx) throw new Error('A login code can only be sent from a request.');
          const locale = await memberLocale(email, ctx);
          const validMinutes = Math.round(limits.codeLifetimeSeconds / 60);
          log.info({ type, locale }, 'Sending an email code');
          if (type === 'sign-in') {
            const token = await createLoginLink(ctx, email, limits.codeLifetimeSeconds);
            const linkUrl = new URL('/login/link', appOrigin);
            linkUrl.searchParams.set('token', token);
            await deps.email.send(
              await loginCodeEmail({
                to: email,
                locale,
                code: otp,
                linkUrl: linkUrl.href,
                validMinutes,
              }),
            );
          } else if (type === 'change-email') {
            await deps.email.send(
              await emailChangeCodeEmail({ to: email, locale, code: otp, validMinutes }),
            );
          } else {
            throw new Error(`Email code type ${type} is not used.`);
          }
        },
      }),
      chakuLogin({ limits, rateLimiter: deps.rateLimiter, botCheck: deps.botCheck }),
      passkey({
        rpID: config.passkeyRpId,
        rpName: 'Chaku',
        origin: appOrigin,
        schema: {
          passkey: {
            modelName: 'passkeys',
            fields: { userId: 'memberId', credentialID: 'credentialId' },
          },
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          // Signups need an Invite; until CHK-21 adds that path, no new Member is created.
          before: () => Promise.reject(signupClosed()),
        },
        update: {
          // After a confirmed email change (D37), alert the old address. The session in the
          // endpoint context was read before the change, so it holds the old address.
          after: async (user, ctx) => {
            if (ctx?.path !== '/email-otp/change-email') return;
            const oldEmail = ctx.context.session?.user.email;
            if (!oldEmail || oldEmail === user.email) return;
            await transaction(db, async (scope) => {
              const [change] = await scope.tx
                .insert(emailChanges)
                .values({ memberId: user.id, oldEmail })
                .returning({ id: emailChanges.id });
              if (!change) throw new Error('Recording the email change returned no row.');
              await addJob(scope, emailChangeAlert, { emailChangeId: change.id });
            });
          },
        },
      },
      account: {
        // We never call Google's APIs, so its tokens aren't kept.
        create: {
          before: (account) =>
            Promise.resolve({
              data: { ...account, accessToken: null, refreshToken: null, idToken: null },
            }),
        },
        update: {
          before: (account) =>
            Promise.resolve({
              data: { ...account, accessToken: null, refreshToken: null, idToken: null },
            }),
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            const authMethod = authMethodByPath[ctx?.path ?? ''];
            if (!authMethod)
              throw new Error(
                `A session was created outside a login: ${ctx?.path ?? 'no endpoint'}.`,
              );
            const [member] = await db
              .select({
                banned: members.banned,
                banExpires: members.banExpires,
                status: members.status,
              })
              .from(members)
              .where(eq(members.id, session.userId));
            if (!member) throw new Error('A session was created for a missing Member.');
            const refused = banError(member);
            if (refused) throw refused;

            let token = ctx?.getCookie(deviceCookieName) ?? null;
            if (!token) {
              token = newDeviceToken();
              ctx?.setCookie(deviceCookieName, token, {
                path: '/',
                maxAge: deviceCookieMaxAge,
                httpOnly: true,
                sameSite: 'lax',
                secure: secureCookies,
              });
            }
            const label = deviceLabel(requestHeaders(ctx)?.get('user-agent'));
            const device = await transaction(db, async (scope) => {
              // Logging in during the deletion grace period cancels the deletion (D5).
              if (member.status === 'deletion_requested') {
                await scope.tx
                  .update(members)
                  .set({ status: 'active', deletionRequestedAt: null, updatedAt: new Date() })
                  .where(eq(members.id, session.userId));
              }
              return recordLoginDevice(scope, session.userId, token, label);
            });
            log.info(
              {
                memberId: session.userId,
                authMethod,
                newDevice: device.isNew,
                deletionCancelled: member.status === 'deletion_requested',
              },
              'Logged in',
            );
            return { data: { ...session, authMethod, loginDeviceId: device.id } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
