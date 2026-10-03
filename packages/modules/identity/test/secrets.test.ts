// CHK-20: no login code, link token or session token reaches a log line or a job payload (D9).
// Every flow that handles one runs with logging at its most verbose, then the secrets are looked
// for in every line and every queued job.
import { queuedJobs, useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { seedIdentity } from '../src/seed.ts';
import {
  Browser,
  codeIn,
  createTestAuth,
  linkTokenIn,
  safariOnIphone,
  type TestAuth,
} from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
});

describe('secrets in logs and jobs', () => {
  it('appear in neither, across code, link, failed and alerted logins', async () => {
    const secrets: string[] = [];
    const remember = (...values: (string | undefined)[]) => {
      for (const value of values) if (value) secrets.push(value);
    };

    // A code login from a first device.
    const laptop = new Browser(testAuth);
    await laptop.requestCode('alice@example.com');
    const first = testAuth.email.last('alice@example.com');
    remember(codeIn(first), linkTokenIn(first));
    await laptop.signInWithCode('alice@example.com', codeIn(first));
    remember(laptop.sessionToken());

    // A link login from a second device: adds the new-device job.
    const phone = new Browser(testAuth, safariOnIphone);
    await phone.requestCode('alice@example.com');
    const second = testAuth.email.last('alice@example.com');
    remember(codeIn(second), linkTokenIn(second));
    await phone.signInWithLink(linkTokenIn(second));
    remember(phone.sessionToken());

    // Failures: a reused link, a wrong code, an unknown address, a rate limit.
    await phone.signInWithLink(linkTokenIn(second));
    await laptop.requestCode('chen@example.com');
    const third = testAuth.email.last('chen@example.com');
    remember(codeIn(third), linkTokenIn(third));
    await laptop.signInWithCode('chen@example.com', codeIn(third) === '000000' ? '1' : '0');
    await laptop.requestCode('stranger@example.com');
    const fourth = testAuth.email.last('stranger@example.com');
    remember(codeIn(fourth), linkTokenIn(fourth));
    await laptop.signInWithCode('stranger@example.com', codeIn(fourth));
    for (let i = 0; i < 4; i++) await laptop.requestCode('daryna@example.com');
    for (const message of testAuth.email.sent.filter((sent) => sent.to === 'daryna@example.com')) {
      remember(codeIn(message), linkTokenIn(message));
    }

    expect(secrets.length).toBeGreaterThan(10);
    const jobs = JSON.stringify(await queuedJobs(database.db));
    expect(jobs).toContain('identity.new_device_alert');
    expect(testAuth.logLines.length).toBeGreaterThan(5);
    const logs = testAuth.logLines.join('\n');
    for (const secret of secrets) {
      expect(logs, 'a log line').not.toContain(secret);
      expect(jobs, 'a job payload').not.toContain(secret);
    }
  });
});
