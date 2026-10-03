// CHK-20: email login with a 6-digit code or the link in the same email (D32, ADR-0010).
import { useTestDatabase } from '@chaku/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessions, verifications } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import {
  appUrl,
  Browser,
  codeIn,
  createTestAuth,
  linkTokenIn,
  seededMember,
  type TestAuth,
} from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const alice = 'alice@example.com';

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

afterEach(() => {
  vi.useRealTimers();
});

async function sessionRows() {
  return database.db
    .select({ memberId: sessions.memberId, authMethod: sessions.authMethod, token: sessions.token })
    .from(sessions);
}

describe('the login email', () => {
  it('has a 6-digit code and a link to the "Log in" page', async () => {
    const browser = new Browser(testAuth);
    const sent = await browser.requestCode(alice);
    expect(sent.status).toBe(200);

    const message = testAuth.email.last(alice);
    expect(message.subject).toBe('Your Chaku login code');
    expect(codeIn(message)).toMatch(/^\d{6}$/);
    expect(message.text).toContain(`${appUrl}/login/link?token=`);
    expect(message.html).toContain(`${appUrl}/login/link?token=${linkTokenIn(message)}`);
    expect(message.html).toContain(codeIn(message));
  });

  it("is in the Member's language", async () => {
    await new Browser(testAuth).requestCode('bohdan@example.com');
    const message = testAuth.email.last('bohdan@example.com');
    expect(message.subject).toBe('Твій код для входу в Chaku');
    expect(message.html).toContain('lang="uk"');
  });

  it("is in the request's language for an address that belongs to no Member", async () => {
    await new Browser(testAuth).requestCode('stranger@example.com', { 'accept-language': 'uk' });
    expect(testAuth.email.last('stranger@example.com').subject).toBe('Твій код для входу в Chaku');
  });

  it('stores only hashes of the code and the link token', async () => {
    await new Browser(testAuth).requestCode(alice);
    const message = testAuth.email.last(alice);
    const rows = await database.db.select().from(verifications);
    const stored = JSON.stringify(rows);
    expect(rows).toHaveLength(2);
    expect(stored).not.toContain(codeIn(message));
    expect(stored).not.toContain(linkTokenIn(message));
  });
});

describe('logging in with the code', () => {
  it('creates an email_code session and sets the session cookie', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const response = await browser.signInWithCode(alice, codeIn(testAuth.email.last(alice)));

    expect(response.status).toBe(200);
    const member = await seededMember(database.db, 'alice');
    expect(response.body).toMatchObject({ user: { id: member.id, email: alice } });
    const token = browser.sessionToken();
    expect(token).toBeDefined();
    expect(await sessionRows()).toEqual([{ memberId: member.id, authMethod: 'email_code', token }]);

    const session = await testAuth.auth.api.getSession({ headers: browser.headers() });
    expect(session?.user.id).toBe(member.id);
    expect(session?.session.authMethod).toBe('email_code');
  });

  it('makes a 30-day session', async () => {
    const response = await new Browser(testAuth).logIn(alice);
    expect(response.status).toBe(200);
    const [row] = await database.db.select().from(sessions);
    const days = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('rejects the code once it was used', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const code = codeIn(testAuth.email.last(alice));
    expect((await browser.signInWithCode(alice, code)).status).toBe(200);

    const again = await new Browser(testAuth).signInWithCode(alice, code);
    expect(again.status).toBe(400);
    expect(again.body).toMatchObject({ code: 'INVALID_OTP' });
    expect(await sessionRows()).toHaveLength(1);
  });

  it('rejects the code after 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const code = codeIn(testAuth.email.last(alice));

    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1000);
    const late = await browser.signInWithCode(alice, code);
    expect(late.status).toBe(400);
    expect(late.body).toMatchObject({ code: 'OTP_EXPIRED' });
    expect(await sessionRows()).toEqual([]);
  });

  it('still takes the code just before 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    vi.setSystemTime(Date.now() + 9 * 60 * 1000 + 50 * 1000);
    expect((await browser.signInWithCode(alice, codeIn(testAuth.email.last(alice)))).status).toBe(
      200,
    );
  });

  it('voids the code after 5 wrong attempts', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const code = codeIn(testAuth.email.last(alice));
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await browser.signInWithCode(alice, wrong);
      expect(response.body, `attempt ${String(attempt)}`).toMatchObject({ code: 'INVALID_OTP' });
    }
    const right = await browser.signInWithCode(alice, code);
    expect(right.status).toBe(403);
    expect(right.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    expect(await sessionRows()).toEqual([]);
  });

  it('takes the right code after 4 wrong attempts', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const code = codeIn(testAuth.email.last(alice));
    const wrong = code === '000000' ? '111111' : '000000';
    for (let attempt = 1; attempt <= 4; attempt++) await browser.signInWithCode(alice, wrong);
    expect((await browser.signInWithCode(alice, code)).status).toBe(200);
  });

  it('voids the link from the same email', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const message = testAuth.email.last(alice);
    await browser.signInWithCode(alice, codeIn(message));

    const link = await new Browser(testAuth).signInWithLink(linkTokenIn(message));
    expect(link.status).toBe(400);
    expect(link.body).toMatchObject({ code: 'INVALID_LINK' });
  });
});

describe('logging in with the link', () => {
  it('creates an email_link session once; a second use fails', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const token = linkTokenIn(testAuth.email.last(alice));

    const first = await browser.signInWithLink(token);
    expect(first.status).toBe(200);
    const member = await seededMember(database.db, 'alice');
    expect(first.body).toMatchObject({ user: { id: member.id } });
    expect(await sessionRows()).toEqual([
      { memberId: member.id, authMethod: 'email_link', token: browser.sessionToken() },
    ]);

    const second = await new Browser(testAuth).signInWithLink(token);
    expect(second.status).toBe(400);
    expect(second.body).toMatchObject({ code: 'INVALID_LINK' });
    expect(await sessionRows()).toHaveLength(1);
  });

  it('expires with the code', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const token = linkTokenIn(testAuth.email.last(alice));

    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1000);
    const late = await browser.signInWithLink(token);
    expect(late.status).toBe(400);
    expect(late.body).toMatchObject({ code: 'INVALID_LINK' });
  });

  it('voids the code from the same email', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const message = testAuth.email.last(alice);
    await browser.signInWithLink(linkTokenIn(message));

    const code = await new Browser(testAuth).signInWithCode(alice, codeIn(message));
    expect(code.status).toBe(400);
    expect(code.body).toMatchObject({ code: 'INVALID_OTP' });
  });

  it('stops working when a newer code is sent', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const older = linkTokenIn(testAuth.email.last(alice));
    await browser.requestCode(alice);

    expect((await browser.signInWithLink(older)).body).toMatchObject({ code: 'INVALID_LINK' });
    const newer = linkTokenIn(testAuth.email.last(alice));
    expect((await browser.signInWithLink(newer)).status).toBe(200);
  });

  it('rejects an unknown token', async () => {
    const response = await new Browser(testAuth).signInWithLink('not-a-token');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_LINK' });
  });
});

describe('the session', () => {
  it('ends on sign-out', async () => {
    const browser = new Browser(testAuth);
    await browser.logIn(alice);
    expect(await sessionRows()).toHaveLength(1);
    expect((await browser.request('/sign-out', {})).status).toBe(200);
    expect(await sessionRows()).toEqual([]);
    expect(await testAuth.auth.api.getSession({ headers: browser.headers() })).toBeNull();
  });

  it('is extended while in use', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
    const browser = new Browser(testAuth);
    await browser.logIn(alice);
    const [before] = await database.db.select().from(sessions);

    vi.setSystemTime(Date.now() + 2 * 86_400_000);
    await testAuth.auth.api.getSession({ headers: browser.headers() });
    const [after] = await database.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, before?.id ?? ''));
    expect((after?.expiresAt.getTime() ?? 0) - (before?.expiresAt.getTime() ?? 0)).toBeGreaterThan(
      86_400_000,
    );
  });
});
