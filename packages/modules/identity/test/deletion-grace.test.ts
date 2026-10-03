// CHK-20: logging in during the 14-day deletion grace period cancels the deletion (D5).
import { useTestDatabase } from '@chaku/db/testing';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { deletionCancelledCookie } from '../src/auth/login-plugin.ts';
import { members } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import {
  Browser,
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
  await database.db
    .update(members)
    .set({ status: 'deletion_requested', deletionRequestedAt: new Date() })
    .where(eq(members.email, alice));
});

describe('logging in during the deletion grace period', () => {
  it('sets the Member back to active, and the response says so', async () => {
    const browser = new Browser(testAuth);
    const response = await browser.logIn(alice);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deletionCancelled: true, user: { status: 'active' } });
    expect(browser.cookies.get(deletionCancelledCookie)).toBe('1');
    const member = await seededMember(database.db, 'alice');
    expect(member.status).toBe('active');
    expect(member.deletionRequestedAt).toBeNull();
  });

  it('works with the link too', async () => {
    const browser = new Browser(testAuth);
    await browser.requestCode(alice);
    const response = await browser.signInWithLink(linkTokenIn(testAuth.email.last(alice)));
    expect(response.body).toMatchObject({ deletionCancelled: true });
    expect((await seededMember(database.db, 'alice')).status).toBe('active');
  });

  it('says nothing for an active Member', async () => {
    const browser = new Browser(testAuth);
    const response = await browser.logIn('chen@example.com');
    expect(response.body).not.toHaveProperty('deletionCancelled');
    expect(browser.cookies.has(deletionCancelledCookie)).toBe(false);
  });
});
