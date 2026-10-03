// CHK-20: until Invites arrive (CHK-21), no login creates a Member.
import { useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { members, sessions } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import { Browser, codeIn, createTestAuth, linkTokenIn, type TestAuth } from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const stranger = 'stranger@example.com';

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

async function counts() {
  return {
    members: (await database.db.select().from(members)).length,
    sessions: (await database.db.select().from(sessions)).length,
  };
}

describe('an email that belongs to no Member', () => {
  it("can't create an account with the code", async () => {
    const before = await counts();
    const browser = new Browser(testAuth);
    expect((await browser.requestCode(stranger)).status).toBe(200);

    const response = await browser.signInWithCode(stranger, codeIn(testAuth.email.last(stranger)));
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'SIGNUP_CLOSED' });
    expect(await counts()).toEqual(before);
    expect(browser.sessionToken()).toBeUndefined();
  });

  it("can't create an account with the link", async () => {
    const before = await counts();
    const browser = new Browser(testAuth);
    await browser.requestCode(stranger);

    const response = await browser.signInWithLink(linkTokenIn(testAuth.email.last(stranger)));
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'SIGNUP_CLOSED' });
    expect(await counts()).toEqual(before);
  });

  it('is refused by the user-creation hook itself, whatever the endpoint', async () => {
    await expect(
      (await testAuth.auth.$context).internalAdapter.createUser(
        { email: stranger, name: '', emailVerified: true },
        { method: 'oauth' },
      ),
    ).rejects.toMatchObject({ body: { code: 'SIGNUP_CLOSED' } });
  });
});
