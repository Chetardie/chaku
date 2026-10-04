// Rate limits (D56) with `rate-limiter-flexible`: on Redis in the apps, so every process counts
// together, and in memory for unit tests. The limits themselves are config owned by the module
// that applies them; this adapter only counts.
import { Redis } from 'ioredis';
import {
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from 'rate-limiter-flexible';

/** One limit: at most `points` actions per key within `durationSeconds`. */
export interface RateLimit {
  /** Unique among the limits, such as `login_code_address_10min`. Part of the Redis key. */
  name: string;
  points: number;
  durationSeconds: number;
}

/** A limit and the key it counts for, such as an address or an IP. */
export interface RateLimitCheck {
  limit: RateLimit;
  key: string;
}

export type RateLimitResult =
  | { allowed: true }
  /** `retryAfter`: whole seconds until the action is allowed again, at least 1. */
  | { allowed: false; retryAfter: number };

export interface RateLimiter {
  /**
   * Counts one action against every check. Allowed only when every check has room; a refused
   * action is not counted against the checks that had room, so a burst over one limit doesn't use
   * up another.
   */
  consume(checks: readonly RateLimitCheck[]): Promise<RateLimitResult>;
  /** Forgets every count for these checks. For tests and Admin tools. */
  reset(checks: readonly RateLimitCheck[]): Promise<void>;
  close(): Promise<void>;
}

type Limiter = Pick<RateLimiterAbstract, 'consume' | 'reward' | 'delete'>;

function createRateLimiter(makeLimiter: (limit: RateLimit) => Limiter, onClose = async () => {}) {
  const limiters = new Map<string, Limiter>();

  const limiterFor = (limit: RateLimit): Limiter => {
    let limiter = limiters.get(limit.name);
    if (!limiter) {
      limiter = makeLimiter(limit);
      limiters.set(limit.name, limiter);
    }
    return limiter;
  };

  const limiter: RateLimiter = {
    async consume(checks) {
      const results = await Promise.all(
        checks.map(async ({ limit, key }) => {
          try {
            await limiterFor(limit).consume(key);
            return { check: { limit, key }, refusedFor: 0 };
          } catch (error) {
            // Refused: a RateLimiterRes. Anything else is a store failure and goes to the caller.
            if (!(error instanceof RateLimiterRes)) throw error;
            return { check: { limit, key }, refusedFor: Math.max(error.msBeforeNext, 1) };
          }
        }),
      );
      const refused = results.filter((result) => result.refusedFor > 0);
      if (refused.length === 0) return { allowed: true };
      await Promise.all(
        results
          .filter((result) => result.refusedFor === 0)
          .map(({ check }) => limiterFor(check.limit).reward(check.key)),
      );
      const longest = Math.max(...refused.map((result) => result.refusedFor));
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(longest / 1000)) };
    },
    async reset(checks) {
      await Promise.all(checks.map(({ limit, key }) => limiterFor(limit).delete(key)));
    },
    close: onClose,
  };
  return limiter;
}

/** Counts in this process only. For unit tests: every instance starts empty. */
export function createMemoryRateLimiter(): RateLimiter {
  return createRateLimiter(
    (limit) =>
      new RateLimiterMemory({
        keyPrefix: limit.name,
        points: limit.points,
        duration: limit.durationSeconds,
      }),
  );
}

export interface RedisRateLimiterOptions {
  /** `redis://host:port`, from `REDIS_URL`. */
  url: string;
  /** Prefix for every key, so tests and apps sharing one Redis don't count together. */
  keyPrefix?: string;
}

/**
 * Counts in Redis, shared by every process. While Redis is unreachable each process counts in its
 * own memory instead, so logins keep working with looser limits.
 */
export function createRedisRateLimiter(options: RedisRateLimiterOptions): RateLimiter {
  // A command waits for the connection, but fails after one reconnect attempt, and then the
  // memory limiter takes it.
  const client = new Redis(options.url, { maxRetriesPerRequest: 1 });
  // Without a listener a connection error would end the process; the next command reconnects.
  client.on('error', () => {});
  const prefix = options.keyPrefix ?? 'rate';
  return createRateLimiter(
    (limit) => {
      const config = {
        keyPrefix: `${prefix}:${limit.name}`,
        points: limit.points,
        duration: limit.durationSeconds,
      };
      return new RateLimiterRedis({
        ...config,
        storeClient: client,
        insuranceLimiter: new RateLimiterMemory(config),
      });
    },
    async () => {
      await client.quit().catch(() => {
        client.disconnect();
      });
    },
  );
}
