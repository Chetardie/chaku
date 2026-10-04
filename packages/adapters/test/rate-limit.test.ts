// CHK-20: the rate-limit adapter counts per key and limit, and reports when to try again (D56).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryRateLimiter, type RateLimit } from '../src/rate-limit.ts';

const tenMinutes: RateLimit = { name: 'per_ten_minutes', points: 3, durationSeconds: 600 };
const perDay: RateLimit = { name: 'per_day', points: 10, durationSeconds: 86_400 };

afterEach(() => {
  vi.useRealTimers();
});

describe('memory rate limiter', () => {
  it('allows the points of a limit, then refuses with the seconds left', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
    const limiter = createMemoryRateLimiter();
    const check = [{ limit: tenMinutes, key: 'a@example.com' }];

    for (let i = 0; i < 3; i++) expect(await limiter.consume(check)).toEqual({ allowed: true });
    vi.setSystemTime(new Date('2026-10-03T12:04:00Z'));
    expect(await limiter.consume(check)).toEqual({ allowed: false, retryAfter: 360 });
  });

  it('allows again once the window has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
    const limiter = createMemoryRateLimiter();
    const check = [{ limit: tenMinutes, key: 'a@example.com' }];
    for (let i = 0; i < 3; i++) await limiter.consume(check);

    vi.setSystemTime(new Date('2026-10-03T12:10:01Z'));
    expect(await limiter.consume(check)).toEqual({ allowed: true });
  });

  it('counts each key on its own', async () => {
    const limiter = createMemoryRateLimiter();
    for (let i = 0; i < 3; i++) await limiter.consume([{ limit: tenMinutes, key: 'a' }]);
    expect(await limiter.consume([{ limit: tenMinutes, key: 'b' }])).toEqual({ allowed: true });
  });

  it("doesn't count a refused action against the limits that had room", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
    const limiter = createMemoryRateLimiter();
    const both = [
      { limit: tenMinutes, key: 'a' },
      { limit: perDay, key: 'a' },
    ];
    for (let i = 0; i < 3; i++) await limiter.consume(both);
    // Refused by the 10-minute limit: the day limit stays at 3 of 10.
    for (let i = 0; i < 5; i++) expect((await limiter.consume(both)).allowed).toBe(false);

    vi.setSystemTime(new Date('2026-10-03T12:11:00Z'));
    for (let i = 0; i < 3; i++) expect(await limiter.consume(both)).toEqual({ allowed: true });
  });

  it('reports the longest wait when several limits refuse', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
    const limiter = createMemoryRateLimiter();
    const short: RateLimit = { name: 'short', points: 1, durationSeconds: 60 };
    const long: RateLimit = { name: 'long', points: 1, durationSeconds: 3600 };
    const both = [
      { limit: short, key: 'a' },
      { limit: long, key: 'a' },
    ];
    await limiter.consume(both);
    expect(await limiter.consume(both)).toEqual({ allowed: false, retryAfter: 3600 });
  });

  it('forgets the counts on reset', async () => {
    const limiter = createMemoryRateLimiter();
    const check = [{ limit: tenMinutes, key: 'a' }];
    for (let i = 0; i < 3; i++) await limiter.consume(check);
    await limiter.reset(check);
    expect(await limiter.consume(check)).toEqual({ allowed: true });
  });
});
