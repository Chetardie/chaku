// CHK-20: a seeded Member logs in with the code from a real email in the stack's Mailpit, and the
// new-device alert job's email arrives there too (D32, D21). Needs `pnpm stack`; run by
// `pnpm stack:check`.
import { randomUUID } from 'node:crypto';

import { createSmtpEmail } from '@chaku/adapters/email';
import { createLogger } from '@chaku/adapters/log';
import { createMemoryRateLimiter } from '@chaku/adapters/rate-limit';
import { queuedJobs, runJob, useTestDatabase } from '@chaku/db/testing';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../src/auth/auth.ts';
import { identityJobs, newDeviceAlert } from '../src/jobs.ts';
import { members, sessions } from '../src/schema.ts';
import { seedIdentity } from '../src/seed.ts';
import { emailsTo, env } from './mailpit.ts';

const database = useTestDatabase();
const appUrl = 'https://chaku.localhost';
const email = createSmtpEmail({ url: env('SMTP_URL'), from: env('EMAIL_FROM') });

/** The seeded Alice, on an address of this run's own: Mailpit is shared. */
let address: string;

beforeEach(async () => {
  await seedIdentity(database.db);
  address = `alice-${randomUUID()}@example.com`;
  await database.db.update(members).set({ email: address }).where(eq(members.username, 'alice'));
});

function auth() {
  return createAuth(
    {
      db: database.db,
      email,
      rateLimiter: createMemoryRateLimiter(),
      botCheck: { verify: () => Promise.resolve(true) },
      log: createLogger({ level: 'silent' }),
      requestLocale: () => 'en',
    },
    { appUrl, secret: 'live-check-secret-only-for-this-test-0000', passkeyRpId: 'chaku.localhost' },
  );
}

function post(instance: ReturnType<typeof auth>, path: string, body: object, userAgent: string) {
  return instance.handler(
    new Request(`${appUrl}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: appUrl, 'user-agent': userAgent },
      body: JSON.stringify(body),
    }),
  );
}

async function logIn(instance: ReturnType<typeof auth>, userAgent: string, emailsBefore: number) {
  const sent = await post(
    instance,
    '/email-otp/send-verification-otp',
    { email: address, type: 'sign-in' },
    userAgent,
  );
  expect(sent.status).toBe(200);
  const [message] = await emailsTo(address, emailsBefore + 1);
  const code = /\b(\d{6})\b/.exec(message?.Text ?? '')?.[1];
  return {
    message,
    response: await post(instance, '/sign-in/email-otp', { email: address, otp: code }, userAgent),
  };
}

describe('email login through Mailpit', () => {
  it('delivers a code and a link, and the code logs in with an email_code session', async () => {
    const instance = auth();
    const { message, response } = await logIn(instance, 'Firefox/143.0 (Windows NT 10.0)', 0);

    expect(message?.Subject).toBe('Your Chaku login code');
    expect(message?.Text).toMatch(/\b\d{6}\b/);
    expect(message?.Text).toContain(`${appUrl}/login/link?token=`);
    expect(message?.HTML).toContain(`${appUrl}/login/link?token=`);

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(';')).toContain('chaku.session_token=');
    const rows = await database.db.select().from(sessions);
    expect(rows.map((row) => row.authMethod)).toEqual(['email_code']);
  });

  it('sends the new-device alert from its job', async () => {
    const instance = auth();
    await logIn(instance, 'Firefox/143.0 (Windows NT 10.0)', 0);
    await logIn(instance, 'Safari/604.1 (iPhone; CPU iPhone OS 19_0 like Mac OS X)', 1);

    const [job] = await queuedJobs(database.db);
    expect(job?.name).toBe('identity.new_device_alert');
    await runJob(
      database.db,
      identityJobs({ email }),
      newDeviceAlert,
      job?.payload as { loginDeviceId: string },
    );

    const [alert] = await emailsTo(address, 3);
    expect(alert?.Subject).toBe('New login to your Chaku account');
    expect(alert?.Text).toContain('Safari · iPhone');
  });
});
