// For Server Components (layouts and pages) that need a logged-in Member: without a session the
// request goes to the login page, which returns to this page afterwards (web data flow doc). It
// redirects instead of calling `unauthorized()`, which still needs an experimental flag.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { pathHeader } from './path-header.ts';
import { getSession, type Session } from './session.ts';

/**
 * `/login?next=…` for a path on this site. Anything else (another origin, `//host`, a missing
 * header) returns to the home page, so the parameter can't send anyone elsewhere.
 */
export function loginPath(next: string | null | undefined): string {
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  if (!safe || next === '/') return '/login';
  return `/login?${new URLSearchParams({ next }).toString()}`;
}

export async function requireMemberPage(): Promise<Session> {
  const requestHeaders = await headers();
  const session = await getSession(requestHeaders);
  if (!session) redirect(loginPath(requestHeaders.get(pathHeader)));
  return session;
}
