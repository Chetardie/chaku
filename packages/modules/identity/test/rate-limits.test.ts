// CHK-20: limits on sending login codes (D56) and the bot check on that endpoint (D44).
import { useTestDatabase } from '@chaku/db/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loginLimits } from '../src/auth/limits.ts';
import { seedIdentity } from '../src/seed.ts';
import { Browser, createTestAuth, type TestAuth } from './helpers/auth.ts';

const database = useTestDatabase();
let testAuth: TestAuth;

const alice = 'alice@example.com';
const minute = 60 * 1000;

beforeEach(async () => {
  await seedIdentity(database.db);
  testAuth = createTestAuth(database.db);
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('login code limits', () => {
  it('refuses a 4th code for the same address within 10 minutes, with retryAfter', async () => {
    const browser = new Browser(testAuth);
    for (let i = 0; i < 3; i++) expect((await browser.requestCode(alice)).status).toBe(200);

    vi.setSystemTime(new Date('2026-10-03T12:04:00Z'));
    const refused = await browser.requestCode(alice);
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 360 });
    expect(refused.headers.get('retry-after')).toBe('360');
    expect(testAuth.email.sent).toHaveLength(3);

    vi.setSystemTime(new Date('2026-10-03T12:10:01Z'));
    expect((await browser.requestCode(alice)).status).toBe(200);
  });

  it('refuses an 11th code for the same address within a day', async () => {
    const browser = new Browser(testAuth);
    let now = new Date('2026-10-03T12:00:00Z').getTime();
    let sent = 0;
    while (sent < 10) {
      for (let i = 0; i < 3 && sent < 10; i++, sent++) {
        expect((await browser.requestCode(alice)).status).toBe(200);
      }
      now += 11 * minute;
      vi.setSystemTime(now);
    }
    const refused = await browser.requestCode(alice);
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'RATE_LIMITED' });
    // The day started at 12:00; four 11-minute steps later, almost all of it is left.
    expect(refused.body?.['retryAfter']).toBe(86_400 - 44 * 60);
  });

  it('refuses a 21st code from the same IP within an hour', async () => {
    const browser = new Browser(testAuth, undefined, { 'x-forwarded-for': '203.0.113.7' });
    for (let i = 0; i < 20; i++) {
      expect((await browser.requestCode(`person${String(i)}@example.com`)).status).toBe(200);
    }
    const refused = await browser.requestCode('person20@example.com');
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 3600 });

    const otherIp = new Browser(testAuth, undefined, { 'x-forwarded-for': '203.0.113.8' });
    expect((await otherIp.requestCode('person20@example.com')).status).toBe(200);
  });

  it('takes its values from config', async () => {
    const strict = createTestAuth(database.db, {
      config: {
        limits: {
          ...loginLimits,
          codesPerAddressShort: { name: 'strict_short', points: 1, durationSeconds: 60 },
        },
      },
    });
    const browser = new Browser(strict);
    expect((await browser.requestCode(alice)).status).toBe(200);
    expect((await browser.requestCode(alice)).body).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 60,
    });
  });

  it('limits email change codes to the new address the same way', async () => {
    const browser = new Browser(testAuth);
    await browser.logIn(alice);
    const target = 'alice.new@example.com';
    for (let i = 0; i < 3; i++) {
      const response = await browser.request('/email-otp/request-email-change', {
        newEmail: target,
      });
      expect(response.status).toBe(200);
    }
    const refused = await browser.request('/email-otp/request-email-change', { newEmail: target });
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('the send-code endpoint', () => {
  it('runs the bot check with the token from the login screen', async () => {
    const tokens: (string | undefined)[] = [];
    const checked = createTestAuth(database.db, {
      botCheck: {
        verify: ({ token }) => {
          tokens.push(token);
          return Promise.resolve(token === 'good');
        },
      },
    });
    const browser = new Browser(checked);

    const refused = await browser.requestCode(alice, { 'x-bot-check-token': 'bad' });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'BOT_CHECK_FAILED' });
    expect(checked.email.sent).toEqual([]);

    expect((await browser.requestCode(alice, { 'x-bot-check-token': 'good' })).status).toBe(200);
    expect(tokens).toEqual(['bad', 'good']);
  });

  it('sends only login codes', async () => {
    const response = await new Browser(testAuth).request('/email-otp/send-verification-otp', {
      email: alice,
      type: 'forget-password',
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'UNSUPPORTED_CODE_TYPE' });
    expect(testAuth.email.sent).toEqual([]);
  });
});
