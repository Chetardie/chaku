// Login limits (D56). Values are config: the web app passes `loginLimits` to `createAuth`, and a
// change here needs no other code change.
import type { RateLimit } from '@chaku/adapters/rate-limit';

export interface LoginLimits {
  /** Login codes per address within 10 minutes. */
  codesPerAddressShort: RateLimit;
  /** Login codes per address per day. */
  codesPerAddressDay: RateLimit;
  /** Login codes per IP per hour. */
  codesPerIp: RateLimit;
  /** Wrong tries before a code is void. */
  wrongAttemptsPerCode: number;
  /** How long a code and its link work, in seconds. */
  codeLifetimeSeconds: number;
}

export const loginLimits: LoginLimits = {
  codesPerAddressShort: { name: 'login_code_address_10min', points: 3, durationSeconds: 600 },
  codesPerAddressDay: { name: 'login_code_address_day', points: 10, durationSeconds: 86_400 },
  codesPerIp: { name: 'login_code_ip_hour', points: 20, durationSeconds: 3600 },
  wrongAttemptsPerCode: 5,
  codeLifetimeSeconds: 600,
};
