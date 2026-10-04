// The base every procedure builds on (D50, web data flow doc): the request headers as context, and
// the typed errors the browser narrows with `isDefinedError`.
import { os } from '@orpc/server';
import { z } from 'zod';

import { getSession } from '../session.ts';

export type { Session } from '../session.ts';

export interface BaseContext {
  headers: Headers;
}

export const base = os.$context<BaseContext>().errors({
  /** No session, or it was revoked. */
  UNAUTHORIZED: {},
  /** It doesn't exist, or the viewer may not see it: one answer for both (D9). */
  NOT_FOUND: {},
  /** Visible but not allowed: a Block (D11), Admin tools without a passkey session (D47). */
  FORBIDDEN: {},
  /** A limit from D56. */
  RATE_LIMITED: {
    status: 429,
    data: z.object({ retryAfter: z.number().int().positive() }),
  },
});

/** The Better Auth session from the request headers, or `null` (web data flow doc). */
export const withSession = base.middleware(async ({ context, next }) =>
  next({ context: { session: await getSession(context.headers) } }),
);

/** A logged-in Member, else `UNAUTHORIZED`. */
export const requireMember = base.middleware(async ({ context, next, errors }) => {
  const session = await getSession(context.headers);
  if (!session) throw errors.UNAUTHORIZED();
  return next({ context: { session } });
});

/** An Admin whose session logged in with a passkey (D47), else `FORBIDDEN`. */
export const requireAdmin = base.middleware(async ({ context, next, errors }) => {
  const session = await getSession(context.headers);
  if (!session) throw errors.UNAUTHORIZED();
  if (session.role !== 'admin' || session.authMethod !== 'passkey') throw errors.FORBIDDEN();
  return next({ context: { session } });
});

/** Procedures for logged-in Members and for Admin tools. */
export const memberProcedure = base.use(requireMember);
export const adminProcedure = base.use(requireAdmin);
