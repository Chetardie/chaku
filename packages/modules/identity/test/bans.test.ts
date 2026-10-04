// CHK-20: banned and suspended Members can't log in, and the error says which (D37).
import { useTestDatabase } from '@chaku/db/testing';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { members, sessions } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import { Browser, codeIn, createTestAuth, linkTokenIn, type TestAuth } from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const alice = 'alice@example.com';

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

function ban(banExpires: Date | null) {
  return database.db
    .update(members)
    .set({ banned: true, banReason: 'spam', banExpires })
    .where(eq(members.email, alice));
}

async function sessionCount() {
  return (await database.db.select().from(sessions)).length;
}

describe('a banned Member', () => {
  it("can't log in with a code, and the error says banned", async () => {
    await ban(null);
    const response = await new Browser(testAuth).logIn(alice);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'MEMBER_BANNED' });
    expect(response.body).not.toHaveProperty('banExpires');
    expect(await sessionCount()).toBe(0);
  });

  it("can't log in with the link either", async () => {
    await ban(null);
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const response = await browser.signInWithLink(linkTokenIn(testAuth.email.last(alice)));
    expect(response.body).toMatchObject({ code: 'MEMBER_BANNED' });
    expect(await sessionCount()).toBe(0);
  });
});

describe('a suspended Member', () => {
  it("can't log in until ban_expires, and the error carries the end date", async () => {
    const until = new Date(Date.now() + 3 * 86_400_000);
    await ban(until);
    const response = await new Browser(testAuth).logIn(alice);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'MEMBER_SUSPENDED',
      banExpires: until.toISOString(),
    });
    expect(await sessionCount()).toBe(0);
  });

  it('can log in once ban_expires has passed', async () => {
    await ban(new Date(Date.now() - 1000));
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const response = await browser.signInWithCode(alice, codeIn(testAuth.email.last(alice)));
    expect(response.status).toBe(200);
    expect(await sessionCount()).toBe(1);
  });
});
