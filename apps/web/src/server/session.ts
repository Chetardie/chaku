// Reading the session of a request (web data flow doc). oRPC middleware and Server Components both
// come here, so a render that calls many procedures looks the session up once (React `cache()`).
import { type AuthMethod, isBanActive } from '@chaku/identity';
import { cache } from 'react';

import { auth } from './auth.ts';

export interface Session {
  memberId: string;
  sessionId: string;
  role: 'member' | 'admin';
  /** How this session logged in. Admin tools need `passkey` (D47). */
  authMethod: AuthMethod;
}

/** Keyed by the cookie header: within one render every call passes the same string. */
const readSession = cache(async (cookie: string): Promise<Session | null> => {
  if (!cookie) return null;
  const found = await auth().api.getSession({ headers: new Headers({ cookie }) });
  if (!found) return null;
  const { user, session } = found;
  // A ban closes the sessions too (D37); until the ban job does that, a banned session reads as none.
  if (isBanActive({ banned: user.banned ?? false, banExpires: user.banExpires })) return null;
  return {
    memberId: user.id,
    sessionId: session.id,
    role: user.role === 'admin' ? 'admin' : 'member',
    authMethod: session.authMethod as AuthMethod,
  };
});

/** The Member's session, or `null` without one. */
export function getSession(headers: Headers): Promise<Session | null> {
  return readSession(headers.get('cookie') ?? '');
}
