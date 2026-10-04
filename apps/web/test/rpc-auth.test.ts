// CHK-20: sessions in oRPC (web data flow doc). `requireMember` and `requireAdmin` (D47), and the
// identity.sessions procedures (D21), against real Postgres and the identity module's Better Auth.
import type { EmailMessage } from '@chaku/adapters/email';
import { createLogger } from '@chaku/adapters/log';
import { createMemoryRateLimiter } from '@chaku/adapters/rate-limit';
import type { Database } from '@chaku/db';
import { useTestDatabase } from '@chaku/db/testing';
import { type Auth, createAuth, seedIdentity } from '@chaku/identity';
import { createRouterClient, isDefinedError, ORPCError } from '@orpc/server';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { base, requireAdmin } from '../src/server/rpc/context.ts';
import { router } from '../src/server/rpc/router.ts';

// Not a React hook: the Postgres test harness (@chaku/db/testing).
// eslint-disable-next-line react-hooks/rules-of-hooks
const database = useTestDatabase();
const appUrl = 'https://chaku.localhost';
const store = globalThis as { chakuAuth?: Auth; chakuDatabase?: Database };

let sent: EmailMessage[];

beforeEach(async () => {
  await seedIdentity(database.db);
  sent = [];
  store.chakuDatabase = database.db;
  store.chakuAuth = createAuth(
    {
      db: database.db,
      email: { send: (message) => Promise.resolve(void sent.push(message)) },
      rateLimiter: createMemoryRateLimiter(),
      botCheck: { verify: () => Promise.resolve(true) },
      log: createLogger({ level: 'silent' }),
      requestLocale: () => 'en',
    },
    {
      appUrl,
      secret: 'test-secret-that-is-only-used-in-tests-0000',
      passkeyRpId: 'chaku.localhost',
    },
  );
});

afterAll(() => {
  store.chakuAuth = undefined;
  store.chakuDatabase = undefined;
});

/** Logs in with an email code, as the login screen will, and returns the request headers. */
async function logIn(
  email: string,
  userAgent = 'Firefox/143.0 (Windows NT 10.0)',
): Promise<Headers> {
  const auth = store.chakuAuth;
  if (!auth) throw new Error('No auth.');
  const post = (path: string, body: object) =>
    auth.handler(
      new Request(`${appUrl}/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: appUrl, 'user-agent': userAgent },
        body: JSON.stringify(body),
      }),
    );
  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
  const code = /\b(\d{6})\b/.exec(
    sent.findLast((message) => message.to === email)?.text ?? '',
  )?.[1];
  const response = await post('/sign-in/email-otp', { email, otp: code });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ');
  return new Headers({ cookie });
}

const client = (headers = new Headers()) => createRouterClient(router, { context: { headers } });

async function errorOf(promise: Promise<unknown>): Promise<ORPCError<string, unknown>> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error;
}

describe('requireMember', () => {
  it('returns UNAUTHORIZED without a session', async () => {
    const error = await errorOf(client().identity.sessions.list());
    expect(error.code).toBe('UNAUTHORIZED');
    expect(isDefinedError(error)).toBe(true);
  });

  it('returns UNAUTHORIZED for a cookie that names no session', async () => {
    const headers = new Headers({ cookie: '__Secure-chaku.session_token=forged.value' });
    expect((await errorOf(client(headers).identity.sessions.list())).code).toBe('UNAUTHORIZED');
  });

  it('passes with a session', async () => {
    const headers = await logIn('alice@example.com');
    const sessions = await client(headers).identity.sessions.list();
    expect(sessions).toHaveLength(1);
  });

  it('returns UNAUTHORIZED once the Member is banned', async () => {
    const headers = await logIn('alice@example.com');
    await database.db.execute(
      sql`update identity.members set banned = true where email = 'alice@example.com'`,
    );
    expect((await errorOf(client(headers).identity.sessions.list())).code).toBe('UNAUTHORIZED');
  });
});

describe('requireAdmin', () => {
  const adminRouter = {
    tool: base.use(requireAdmin).handler(({ context }) => context.session.memberId),
  };
  const adminClient = (headers = new Headers()) =>
    createRouterClient(adminRouter, { context: { headers } });

  it('returns FORBIDDEN for an Admin whose session is not a passkey session', async () => {
    const headers = await logIn('admin@example.com');
    const error = await errorOf(adminClient(headers).tool());
    expect(error.code).toBe('FORBIDDEN');
    expect(isDefinedError(error)).toBe(true);
  });

  it('returns FORBIDDEN for a Member with a passkey session', async () => {
    const headers = await logIn('alice@example.com');
    await database.db.execute(sql`update identity.sessions set auth_method = 'passkey'`);
    expect((await errorOf(adminClient(headers).tool())).code).toBe('FORBIDDEN');
  });

  it('passes for an Admin with a passkey session', async () => {
    const headers = await logIn('admin@example.com');
    await database.db.execute(sql`update identity.sessions set auth_method = 'passkey'`);
    const [admin] = (
      await database.db.execute<{ id: string }>(
        sql`select id from identity.members where username = 'admin'`,
      )
    ).rows;
    expect(await adminClient(headers).tool()).toBe(admin?.id);
  });

  it('returns UNAUTHORIZED without a session', async () => {
    expect((await errorOf(adminClient().tool())).code).toBe('UNAUTHORIZED');
  });
});

describe('identity.sessions', () => {
  it('lists only my own sessions, with the current one marked', async () => {
    const laptop = await logIn('alice@example.com');
    await logIn('alice@example.com', 'Safari/604.1 (iPhone; CPU iPhone OS 19_0 like Mac OS X)');
    await logIn('chen@example.com');

    const list = await client(laptop).identity.sessions.list();
    expect(list).toHaveLength(2);
    expect(list.filter((session) => session.current)).toHaveLength(1);
    expect(list.map((session) => session.authMethod)).toEqual(['email_code', 'email_code']);
    expect(list.map((session) => session.deviceLabel).sort()).toEqual([
      'Firefox · Windows',
      'Safari · iPhone',
    ]);
  });

  it('revoking one ends it: its next request is UNAUTHORIZED', async () => {
    const laptop = await logIn('alice@example.com');
    const phone = await logIn('alice@example.com', 'Safari/604.1 (iPhone)');
    const other = (await client(laptop).identity.sessions.list()).find((s) => !s.current);

    expect(await client(laptop).identity.sessions.revoke({ sessionId: other?.id ?? '' })).toEqual({
      revoked: true,
    });
    expect((await errorOf(client(phone).identity.sessions.list())).code).toBe('UNAUTHORIZED');
    expect(await client(laptop).identity.sessions.list()).toHaveLength(1);
  });

  it("answers NOT_FOUND for someone else's session, and leaves it", async () => {
    const alice = await logIn('alice@example.com');
    const chen = await logIn('chen@example.com');
    const [chens] = await client(chen).identity.sessions.list();

    const error = await errorOf(
      client(alice).identity.sessions.revoke({ sessionId: chens?.id ?? '' }),
    );
    expect(error.code).toBe('NOT_FOUND');
    expect(await client(chen).identity.sessions.list()).toHaveLength(1);
  });

  it('"log out everywhere else" keeps only the current session', async () => {
    const laptop = await logIn('alice@example.com');
    const phone = await logIn('alice@example.com', 'Safari/604.1 (iPhone)');
    const tablet = await logIn('alice@example.com', 'Safari/604.1 (iPad)');

    expect(await client(laptop).identity.sessions.revokeOthers()).toEqual({ revoked: 2 });
    const list = await client(laptop).identity.sessions.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.current).toBe(true);
    for (const headers of [phone, tablet]) {
      expect((await errorOf(client(headers).identity.sessions.list())).code).toBe('UNAUTHORIZED');
    }
  });
});
