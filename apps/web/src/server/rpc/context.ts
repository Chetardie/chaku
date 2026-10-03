// The base every procedure builds on (D50, web data flow doc): the request headers as context, and
// the typed errors the browser narrows with `isDefinedError`.
import { os } from '@orpc/server';
import { z } from 'zod';

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

export interface Session {
  memberId: string;
}

/**
 * Reads the session from the request headers. Better Auth, and `requireMember` and
 * `requireAdmin` on top of this, arrive in CHK-20; until then nobody has a session.
 */
export const withSession = base.middleware(({ next }) =>
  next({ context: { session: null as Session | null } }),
);
