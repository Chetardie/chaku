// The worker's environment, validated with Zod when it starts, like the web app's (D23). Locally the
// values come from the repo's `.env` and `.env.example` (package.json scripts); deployed, from
// the platform.
import { z } from 'zod';

const logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Alert emails (new device, email change) go out from jobs (D21, D37). */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  EMAIL_FROM: z.string().min(3),
  /** Jobs this process runs at once. The beta runs one worker process. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export class InvalidEnvError extends Error {
  override name = 'InvalidEnvError';
}

/**
 * Parses the environment. On failure the message names each bad variable and what is wrong with
 * it, never its value: values can be secrets, and this message ends up in logs.
 */
export function parseWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
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
