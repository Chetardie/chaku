// CHK-20: the new-device alert (D21). The device is a long-lived random cookie; only its hash is
// stored, and a login from a device the Member hasn't used before adds the alert job.
import { createHash } from 'node:crypto';

import { queuedJobs, runJob, useTestDatabase } from '@chaku/db/testing';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { deviceCookieName, deviceLabel } from '../src/auth/devices.ts';
import { identityJobs, newDeviceAlert } from '../src/jobs.ts';
import { loginDevices, members, sessions } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import {
  Browser,
  CapturingEmail,
  createTestAuth,
  firefoxOnWindows,
  safariOnIphone,
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

describe('the device cookie', () => {
  it('is set on the first login and only its hash is stored', async () => {
    const browser = new Browser(testAuth);
    await browser.logIn(alice);
    const token = browser.cookies.get(deviceCookieName);
    expect(token).toMatch(/^[\w-]{43}$/);

    const rows = await database.db.select().from(loginDevices);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deviceHash).toEqual(
      createHash('sha256')
        .update(token ?? '')
        .digest(),
    );
    expect(rows[0]?.label).toBe('Firefox · Windows');
    const [session] = await database.db.select().from(sessions);
    expect(session?.loginDeviceId).toBe(rows[0]?.id);
  });

  it('is kept by the next login from the same browser', async () => {
    const browser = new Browser(testAuth);
    await browser.logIn(alice);
    const token = browser.cookies.get(deviceCookieName);
    await browser.request('/sign-out', {});
    await browser.logIn(alice);
    expect(browser.cookies.get(deviceCookieName)).toBe(token);
    expect(await database.db.select().from(loginDevices)).toHaveLength(1);
  });
});

describe('a login from a new device', () => {
  it('adds no job for the first login of a Member', async () => {
    await new Browser(testAuth).logIn(alice);
    expect(await queuedJobs(database.db)).toEqual([]);
  });

  it('adds the alert job, with only the device ID in its payload', async () => {
    await new Browser(testAuth).logIn(alice);
    await new Browser(testAuth, safariOnIphone).logIn(alice);

    const [device] = await database.db
      .select()
      .from(loginDevices)
      .where(eq(loginDevices.label, 'Safari · iPhone'));
    expect(await queuedJobs(database.db)).toMatchObject([
      { name: 'identity.new_device_alert', payload: { loginDeviceId: device?.id } },
    ]);
  });

  it('adds no job from a device the Member already used', async () => {
    const laptop = new Browser(testAuth);
    await laptop.logIn(alice);
    await new Browser(testAuth, safariOnIphone).logIn(alice);
    const before = await queuedJobs(database.db);

    await laptop.request('/sign-out', {});
    await laptop.logIn(alice);
    expect(await queuedJobs(database.db)).toEqual(before);
  });

  it("counts each Member's devices apart", async () => {
    const shared = new Browser(testAuth);
    await shared.logIn(alice);
    await shared.request('/sign-out', {});
    // Chen's first login, from a browser Alice used: still Chen's first device.
    await shared.logIn('chen@example.com');
    expect(await queuedJobs(database.db)).toEqual([]);
  });
});

describe('identity.new_device_alert', () => {
  async function aliceOnTwoDevices() {
    await new Browser(testAuth).logIn(alice);
    await new Browser(testAuth, safariOnIphone).logIn(alice);
    const [job] = await queuedJobs(database.db);
    return job?.payload as { loginDeviceId: string };
  }

  it('emails the Member the device label and time', async () => {
    const payload = await aliceOnTwoDevices();
    const email = new CapturingEmail();
    await runJob(database.db, identityJobs({ email }), newDeviceAlert, payload);

    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message?.to).toBe(alice);
    expect(message?.subject).toBe('New login to your Chaku account');
    expect(message?.text).toContain('Safari · iPhone');
    expect(message?.text).toMatch(/\d{4}.*UTC/);
  });

  it("writes in the Member's language", async () => {
    await database.db.update(members).set({ locale: 'uk' }).where(eq(members.email, alice));
    const payload = await aliceOnTwoDevices();
    const email = new CapturingEmail();
    await runJob(database.db, identityJobs({ email }), newDeviceAlert, payload);
    expect(email.sent[0]?.subject).toBe('Новий вхід у твій акаунт Chaku');
  });

  it('sends nothing when the device is gone', async () => {
    const payload = await aliceOnTwoDevices();
    const member = await seededMember(database.db, 'alice');
    await database.db.delete(sessions).where(eq(sessions.memberId, member.id));
    await database.db.delete(loginDevices).where(eq(loginDevices.memberId, member.id));
    const email = new CapturingEmail();
    await runJob(database.db, identityJobs({ email }), newDeviceAlert, payload);
    expect(email.sent).toEqual([]);
  });
});

describe('deviceLabel', () => {
  it.each([
    [firefoxOnWindows, 'Firefox · Windows'],
    [safariOnIphone, 'Safari · iPhone'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Chrome · Mac',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
    ['curl/8.9.1', ''],
    [undefined, ''],
  ])('names %s', (userAgent, label) => {
    expect(deviceLabel(userAgent)).toBe(label);
  });
});
