// CHK-20: Server Components that need a Member send everyone else to the login page, which returns
// them to the page afterwards (web data flow doc).
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pathHeader } from '../src/server/path-header.ts';
import { loginPath, requireMemberPage } from '../src/server/require-member-page.ts';

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
const session = vi.hoisted(() => ({ current: null as object | null }));

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(requestHeaders.current) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock('../src/server/session.ts', () => ({ getSession: () => Promise.resolve(session.current) }));

beforeEach(() => {
  requestHeaders.current = new Headers();
  session.current = null;
});

describe('requireMemberPage', () => {
  it('redirects to /login?next=… without a session', async () => {
    requestHeaders.current = new Headers({ [pathHeader]: '/chats/123?tab=media' });
    await expect(requireMemberPage()).rejects.toThrow(
      'redirect /login?next=%2Fchats%2F123%3Ftab%3Dmedia',
    );
  });

  it('returns the session when there is one', async () => {
    session.current = { memberId: 'm', sessionId: 's', role: 'member', authMethod: 'email_code' };
    await expect(requireMemberPage()).resolves.toBe(session.current);
  });
});

describe('loginPath', () => {
  it.each([
    ['/chats', '/login?next=%2Fchats'],
    ['/', '/login'],
    [null, '/login'],
    ['', '/login'],
    // Only paths on this site: never another origin.
    ['//evil.example/x', '/login'],
    ['/\\evil.example', '/login'],
    ['https://evil.example/', '/login'],
  ])('%s → %s', (next, expected) => {
    expect(loginPath(next)).toBe(expected);
  });
});
