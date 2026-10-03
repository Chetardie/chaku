// CHK-20: changing the email needs a code sent to the new address, and the old address gets an
// alert through a job (D37).
import { queuedJobs, runJob, useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { emailChangeAlert, identityJobs } from '../src/jobs.ts';
import { emailChanges } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import {
  Browser,
  CapturingEmail,
  codeIn,
  createTestAuth,
  seededMember,
  type TestAuth,
} from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const alice = 'alice@example.com';
const newAddress = 'alice.new@example.com';

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

async function loggedInAlice(): Promise<Browser> {
  const browser = new Browser(testAuth);
  await browser.logIn(alice);
  return browser;
}

describe('changing the email', () => {
  it('sends a code to the new address, with no login link', async () => {
    const browser = await loggedInAlice();
    const response = await browser.request('/email-otp/request-email-change', {
      newEmail: newAddress,
    });
    expect(response.status).toBe(200);
    const message = testAuth.email.last(newAddress);
    expect(message.subject).toBe('Confirm your new Chaku email address');
    expect(codeIn(message)).toMatch(/^\d{6}$/);
    expect(message.text).not.toContain('/login/link');
  });

  it('needs that code: a wrong one changes nothing', async () => {
    const browser = await loggedInAlice();
    await browser.request('/email-otp/request-email-change', { newEmail: newAddress });
    const code = codeIn(testAuth.email.last(newAddress));
    const wrong = code === '000000' ? '111111' : '000000';

    const response = await browser.request('/email-otp/change-email', {
      newEmail: newAddress,
      otp: wrong,
    });
    expect(response.status).toBe(400);
    expect((await seededMember(database.db, 'alice')).email).toBe(alice);
    expect(await queuedJobs(database.db)).toEqual([]);
  });

  it('needs a logged-in Member', async () => {
    const response = await new Browser(testAuth).request('/email-otp/request-email-change', {
      newEmail: newAddress,
    });
    expect(response.status).toBe(401);
  });

  it('changes the email with the code and adds the alert job for the old address', async () => {
    const browser = await loggedInAlice();
    await browser.request('/email-otp/request-email-change', { newEmail: newAddress });
    const response = await browser.request('/email-otp/change-email', {
      newEmail: newAddress,
      otp: codeIn(testAuth.email.last(newAddress)),
    });
    expect(response.status).toBe(200);

    const member = await seededMember(database.db, 'alice');
    expect(member.email).toBe(newAddress);
    const [change] = await database.db.select().from(emailChanges);
    expect(change).toMatchObject({ memberId: member.id, oldEmail: alice });
    // The job carries the row's ID, never an address (D9).
    expect(await queuedJobs(database.db)).toMatchObject([
      { name: 'identity.email_change_alert', payload: { emailChangeId: change?.id } },
    ]);
    expect(JSON.stringify(await queuedJobs(database.db))).not.toContain('@');
  });

  it('then the old address gets the alert, once', async () => {
    const browser = await loggedInAlice();
    await browser.request('/email-otp/request-email-change', { newEmail: newAddress });
    await browser.request('/email-otp/change-email', {
      newEmail: newAddress,
      otp: codeIn(testAuth.email.last(newAddress)),
    });
    const [job] = await queuedJobs(database.db);
    const payload = job?.payload as { emailChangeId: string };

    const email = new CapturingEmail();
    await runJob(database.db, identityJobs({ email }), emailChangeAlert, payload);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      to: alice,
      subject: 'The email address of your Chaku account was changed',
    });
    expect(email.sent[0]?.text).not.toContain(newAddress);
    expect(await database.db.select().from(emailChanges)).toEqual([]);

    // A second run (a retry) finds nothing left to send.
    await runJob(database.db, identityJobs({ email }), emailChangeAlert, payload, 2);
    expect(email.sent).toHaveLength(1);
  });

  it('logs in with the new address afterwards, not the old one', async () => {
    const browser = await loggedInAlice();
    await browser.request('/email-otp/request-email-change', { newEmail: newAddress });
    await browser.request('/email-otp/change-email', {
      newEmail: newAddress,
      otp: codeIn(testAuth.email.last(newAddress)),
    });

    expect((await new Browser(testAuth).logIn(newAddress)).status).toBe(200);
    expect((await new Browser(testAuth).logIn(alice)).body).toMatchObject({
      code: 'SIGNUP_CLOSED',
    });
  });
});
