// CHK-20: the sessions page's functions (D21): my sessions only, revoking one, revoking the rest.
import { useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { seedIdentity } from '../src/seed.ts';
import { listSessions, revokeOtherSessions, revokeSession } from '../src/sessions.ts';
import { Browser, createTestAuth, safariOnIphone, type TestAuth } from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const alice = 'alice@example.com';

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

async function sessionOf(browser: Browser) {
  const session = await testAuth.auth.api.getSession({ headers: browser.headers() });
  if (!session) throw new Error('No session.');
  return session;
}

async function aliceOnTwoDevicesAndChen() {
  const laptop = new Browser(testAuth);
  await laptop.logIn(alice);
  const phone = new Browser(testAuth, safariOnIphone);
  await phone.logIn(alice);
  const chen = new Browser(testAuth);
  await chen.logIn('chen@example.com');
  return { laptop, phone, chen };
}

describe('listSessions', () => {
  it("lists only the Member's own sessions, with device, method and the current one", async () => {
    const { laptop } = await aliceOnTwoDevicesAndChen();
    const current = await sessionOf(laptop);

    const list = await listSessions(database.db, current.user.id, current.session.id);
    expect(list).toHaveLength(2);
    expect(list.map((session) => session.deviceLabel).sort()).toEqual([
      'Firefox · Windows',
      'Safari · iPhone',
    ]);
    expect(list.every((session) => session.authMethod === 'email_code')).toBe(true);
    expect(list.filter((session) => session.current).map((session) => session.id)).toEqual([
      current.session.id,
    ]);
    expect(list[0]?.lastActiveAt).toBeInstanceOf(Date);
    expect(JSON.stringify(list)).not.toContain(laptop.sessionToken());
  });
});

describe('revokeSession', () => {
  it('ends the session: its next request has none', async () => {
    const { laptop, phone } = await aliceOnTwoDevicesAndChen();
    const current = await sessionOf(laptop);
    const other = await sessionOf(phone);

    expect(await revokeSession(database.db, current.user.id, other.session.id)).toBe(true);
    expect(await testAuth.auth.api.getSession({ headers: phone.headers() })).toBeNull();
    expect(await testAuth.auth.api.getSession({ headers: laptop.headers() })).not.toBeNull();
  });

  it("can't end another Member's session", async () => {
    const { laptop, chen } = await aliceOnTwoDevicesAndChen();
    const current = await sessionOf(laptop);
    const chens = await sessionOf(chen);

    expect(await revokeSession(database.db, current.user.id, chens.session.id)).toBe(false);
    expect(await testAuth.auth.api.getSession({ headers: chen.headers() })).not.toBeNull();
  });
});

describe('revokeOtherSessions', () => {
  it('keeps only the current session of the Member', async () => {
    const { laptop, phone, chen } = await aliceOnTwoDevicesAndChen();
    const current = await sessionOf(laptop);

    expect(await revokeOtherSessions(database.db, current.user.id, current.session.id)).toBe(1);
    expect(await testAuth.auth.api.getSession({ headers: phone.headers() })).toBeNull();
    expect(await testAuth.auth.api.getSession({ headers: laptop.headers() })).not.toBeNull();
    expect(await testAuth.auth.api.getSession({ headers: chen.headers() })).not.toBeNull();
    expect(await listSessions(database.db, current.user.id, current.session.id)).toHaveLength(1);
  });
});
