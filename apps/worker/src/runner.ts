// Runs the modules' jobs with Graphile Worker (ADR-0008). Modules define jobs and handlers through
// their public entry points; this file only wires them up.
import type { Logger as AppLogger } from '@chaku/adapters/log';
import {
  type Database,
  InvalidJobError,
  InvalidJobPayloadError,
  type JobHandler,
  type ModuleJobs,
} from '@chaku/db';
import {
  type Job as QueuedJob,
  Logger,
  parseCronItems,
  type ParsedCronItem,
  run,
  type Runner,
  type TaskList,
} from 'graphile-worker';

/** Collects every module's handlers into one task list, one name per job. */
export function buildTaskList(
  modules: readonly ModuleJobs[],
  db: Database,
  log: AppLogger,
): TaskList {
  const handlers = new Map<string, JobHandler>();
  for (const { handlers: list } of modules) {
    for (const handler of list) {
      if (handlers.has(handler.job.name)) {
        throw new InvalidJobError(`Two handlers for ${handler.job.name}.`);
      }
      handlers.set(handler.job.name, handler);
    }
  }
  const tasks: TaskList = {};
  for (const [name, handler] of handlers) {
    tasks[name] = async (payload, helpers) => {
      // A stored payload is checked again: it fails the job without reaching the handler.
      const parsed = handler.job.payload.safeParse(payload);
      if (!parsed.success) throw new InvalidJobPayloadError(name, parsed.error);
      const job = {
        id: helpers.job.id,
        name,
        attempt: helpers.job.attempts,
        maxAttempts: helpers.job.max_attempts,
      };
      await handler.run(parsed.data, {
        db,
        log: log.child({ job: name, jobId: job.id, attempt: job.attempt }),
        job,
        signal: helpers.abortSignal,
      });
    };
  }
  return tasks;
}

/** Every module's cron schedules, each for a job that has a handler. */
export function buildCronItems(modules: readonly ModuleJobs[]): ParsedCronItem[] {
  const handled = new Set(modules.flatMap((module) => module.handlers.map((h) => h.job.name)));
  const items = modules.flatMap((module) => module.cron ?? []);
  for (const { job } of items) {
    if (!handled.has(job.name))
      throw new InvalidJobError(`${job.name} is scheduled but has no handler.`);
    if (!job.payload.safeParse({}).success) {
      throw new InvalidJobError(`${job.name} is scheduled, so its payload must accept {}.`);
    }
  }
  return parseCronItems(
    items.map(({ job, match, backfillPeriod }) => ({
      task: job.name,
      identifier: job.name,
      match,
      options: { backfillPeriod: backfillPeriod ?? 0 },
    })),
  );
}

const levels: Record<'error' | 'warning' | 'info' | 'debug', 'error' | 'warn' | 'info' | 'debug'> =
  {
    error: 'error',
    warning: 'warn',
    info: 'info',
    debug: 'debug',
  };

/**
 * Graphile Worker's log lines through our logger. Its job lines carry the whole job, payload
 * included, so only the job's name, ID and attempt and the error pass (D9).
 */
export function graphileLogger(log: AppLogger): Logger {
  return new Logger((scope) => (level, message, meta) => {
    const job = meta['job'] as QueuedJob | undefined;
    const error = meta['error'];
    if (job) {
      const fields = {
        job: job.task_identifier,
        jobId: job.id,
        attempt: job.attempts,
        maxAttempts: job.max_attempts,
        ...(error instanceof Error ? { err: error } : {}),
      };
      if (meta['failure']) {
        const final = job.attempts >= job.max_attempts;
        log[final ? 'error' : 'warn'](
          fields,
          final ? 'Job failed for good' : 'Job failed; it will be retried',
        );
      } else {
        log[levels[level]](fields, meta['success'] ? 'Job done' : message.split(' (')[0]);
      }
      return;
    }
    log[levels[level]]({ graphile: scope.label }, message);
  });
}

export interface WorkerOptions {
  db: Database;
  log: AppLogger;
  modules: readonly ModuleJobs[];
  concurrency: number;
  /** Milliseconds between checks for due jobs, on top of instant notification of new ones. */
  pollInterval?: number;
}

/**
 * Starts running jobs. `stop()` takes no new jobs, waits for the running ones to finish and
 * resolves; the database pool stays open for the caller to close.
 */
export async function startWorker(options: WorkerOptions): Promise<Runner> {
  const { db, log, modules, concurrency, pollInterval } = options;
  return run({
    pgPool: db.$client,
    concurrency,
    pollInterval,
    // Signals are handled in main.ts, so the process exits after the pool closes.
    noHandleSignals: true,
    logger: graphileLogger(log),
    taskList: buildTaskList(modules, db, log),
    parsedCronItems: buildCronItems(modules),
  });
}
