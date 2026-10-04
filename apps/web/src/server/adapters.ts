// The web app's logger and vendor adapters, created once per server process from the validated
// environment. Every one is the local or no-op version until phase 4 (D23, D55).
import { createNoopAnalytics, type Analytics } from '@chaku/adapters/analytics';
import { createPassingBotCheck, type BotCheck } from '@chaku/adapters/bot-check';
import { createSmtpEmail, type EmailSender } from '@chaku/adapters/email';
import { createLogErrorReporter, type ErrorReporter } from '@chaku/adapters/errors';
import { createLogger, type Logger } from '@chaku/adapters/log';
import { createLogPush, type PushSender } from '@chaku/adapters/push';
import { createRedisRateLimiter, type RateLimiter } from '@chaku/adapters/rate-limit';
import { createS3Storage, type Storage } from '@chaku/adapters/storage';

import { serverEnv } from '../env.ts';

export interface Adapters {
  log: Logger;
  email: EmailSender;
  storage: Storage;
  push: PushSender;
  analytics: Analytics;
  errors: ErrorReporter;
  botCheck: BotCheck;
  rateLimiter: RateLimiter;
}

function createAdapters(): Adapters {
  const env = serverEnv();
  const log = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
  return {
    log,
    email: createSmtpEmail({ url: env.SMTP_URL, from: env.EMAIL_FROM }),
    storage: createS3Storage({
      endpoint: env.S3_ENDPOINT,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    }),
    push: createLogPush(log),
    analytics: createNoopAnalytics(),
    errors: createLogErrorReporter(log),
    botCheck: createPassingBotCheck(),
    rateLimiter: createRedisRateLimiter({ url: env.REDIS_URL }),
  };
}

// Kept on globalThis so development reloads don't open new SMTP, S3 and Redis clients each time.
const store = globalThis as { chakuAdapters?: Adapters };

export function adapters(): Adapters {
  store.chakuAdapters ??= createAdapters();
  return store.chakuAdapters;
}
