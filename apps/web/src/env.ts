// The web app's environment, validated with Zod when the server starts (D23, ADR-0011). Every origin
// comes from here, so previews get the right CSP and links (ADR-0010). Locally the values come
// from the repo's `.env` and `.env.example` (next.config.ts); deployed, from the platform.
import { z } from 'zod';

const logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

/** An optional value: unset and empty (`GOOGLE_CLIENT_ID=` in .env.example) both mean "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(logLevels).default('info'),

  APP_URL: z.url({ protocol: /^https?$/ }),
  REALTIME_URL: z.url({ protocol: /^wss?$/ }),
  /** Games run on subdomains of this domain (ADR-0002). */
  GAMES_DOMAIN: z.hostname(),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),

  /** Signs Better Auth's cookies (ADR-0004). At least 32 characters. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Passkeys are bound to this domain, the apex app domain (D41). APP_URL is their origin. */
  PASSKEY_RP_ID: z.hostname(),
  /** Google login is on only when both are set (ADR-0010: never in previews). */
  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),

  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  EMAIL_FROM: z.string().min(3),

  S3_ENDPOINT: z.url({ protocol: /^https?$/ }),
  S3_PUBLIC_ENDPOINT: z.url({ protocol: /^https?$/ }),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_PRIVATE: z.string().min(1),
  S3_BUCKET_PUBLIC: z.string().min(1),
});

/** The schema with the checks across variables. */
const checkedEnvSchema = serverEnvSchema.superRefine((env, context) => {
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({
      code: 'custom',
      path: [env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_SECRET' : 'GOOGLE_CLIENT_ID'],
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set together',
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class InvalidEnvError extends Error {
  override name = 'InvalidEnvError';
}

/**
 * Parses the environment. On failure the message names each bad variable and what is wrong with
 * it, never its value: values can be secrets, and this message ends up in logs.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = checkedEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    return source[name] === undefined || source[name] === ''
      ? `${name} is not set`
      : `${name} is invalid (${issue.code})`;
  });
  throw new InvalidEnvError(
    `The environment is not valid. See .env.example.\n  ${problems.join('\n  ')}`,
  );
}

let cached: ServerEnv | undefined;

/** The validated environment of this process. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
