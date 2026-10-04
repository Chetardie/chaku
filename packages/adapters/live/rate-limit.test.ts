// CHK-20: the rate-limit adapter counts in the stack's Redis (D56). Needs `pnpm stack`.
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { createRedisRateLimiter, type RateLimit } from '../src/rate-limit.ts';
import { env } from './env.ts';

// A fresh prefix per run, so other runs sharing the stack's Redis count apart.
const keyPrefix = `check-${randomUUID()}`;
const first = createRedisRateLimiter({ url: env('REDIS_URL'), keyPrefix });
const second = createRedisRateLimiter({ url: env('REDIS_URL'), keyPrefix });

afterAll(async () => {
  await Promise.all([first.close(), second.close()]);
});

describe('rate-limit adapter (Redis)', () => {
  it('counts across processes and refuses with the seconds left', async () => {
    const limit: RateLimit = { name: 'live_check', points: 2, durationSeconds: 600 };
    const check = [{ limit, key: 'adapter-check@example.com' }];

    expect(await first.consume(check)).toEqual({ allowed: true });
    expect(await second.consume(check)).toEqual({ allowed: true });
    const refused = await first.consume(check);
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfter).toBeGreaterThan(590);
      expect(refused.retryAfter).toBeLessThanOrEqual(600);
    }

    await second.reset(check);
    expect(await first.consume(check)).toEqual({ allowed: true });
  });
});
