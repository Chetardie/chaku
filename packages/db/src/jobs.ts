// Jobs (ADR-0008): every side effect and timer is a Graphile Worker job, added with
// `graphile_worker.add_job(...)` in the same transaction as the change, so the queue is our outbox.
// A module defines its jobs here and exports their handlers through its public entry point;
// `apps/worker` only wires them up. Nothing here imports Graphile Worker: apps and modules add
// jobs with plain SQL, and only the worker runs them.
import { z } from 'zod';

import type { Database } from './client.ts';
import type { TransactionScope } from './transaction.ts';

/** `<area>.<event>` in snake case, such as `member.erasure_requested`. */
const jobNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** Every payload is a JSON object of IDs and small values, described by a Zod object. */
export type JobPayloadSchema = z.ZodObject;

/** A kind of job: its name in the queue and the shape of its payload. Made with `defineJob`. */
export interface Job<Payload extends JobPayloadSchema = JobPayloadSchema> {
  readonly name: string;
  readonly payload: Payload;
}

export class InvalidJobError extends Error {
  override name = 'InvalidJobError';
}

/**
 * Thrown when a payload doesn't match its job's schema. The message names the fields and what is
 * wrong with them, never their values.
 */
export class InvalidJobPayloadError extends Error {
  override name = 'InvalidJobPayloadError';

  constructor(job: string, error: z.ZodError) {
    const problems = error.issues.map(
      (issue) => `${issue.path.join('.') || '(payload)'} (${issue.code})`,
    );
    super(`The payload of ${job} is invalid: ${problems.join(', ')}`);
  }
}

type JsonSchema = Record<string, unknown>;

/** String formats a payload may carry: IDs and points in time, never text someone wrote. */
const allowedStringFormats = new Set(['uuid', 'date-time', 'date']);

/**
 * Lists the fields of a payload schema that could carry free text (D9, ADR-0008). Payloads hold
 * IDs, enums, numbers, booleans and timestamps only, so erasure never rewrites a queued job and
 * no Message or Comment body reaches the queue or the logs. An empty list means the schema is fine.
 */
export function payloadProblems(schema: JobPayloadSchema): string[] {
  const root = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  const definitions = (root['$defs'] ?? {}) as Record<string, JsonSchema>;
  const problems: string[] = [];
  const seen = new Set<string>();

  const visit = (node: JsonSchema, path: string): void => {
    const ref = node['$ref'];
    if (typeof ref === 'string') {
      const name = ref.replace('#/$defs/', '');
      const target = definitions[name];
      if (!target) problems.push(`${path}: unresolved ${ref}`);
      else if (!seen.has(name)) {
        seen.add(name);
        visit(target, path);
      }
      return;
    }
    if ('const' in node || Array.isArray(node['enum'])) return;
    for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
      const options = node[key];
      if (Array.isArray(options)) {
        for (const option of options as JsonSchema[]) visit(option, path);
        return;
      }
    }

    const type = node['type'];
    switch (type) {
      case 'integer':
      case 'number':
      case 'boolean':
      case 'null':
        return;
      case 'string': {
        const format = node['format'];
        if (typeof format !== 'string' || !allowedStringFormats.has(format)) {
          problems.push(`${path}: free text (use a UUID, an enum or a timestamp)`);
        }
        return;
      }
      case 'array': {
        const items = node['items'];
        if (items && typeof items === 'object') visit(items as JsonSchema, `${path}[]`);
        else problems.push(`${path}: an array of anything`);
        return;
      }
      case 'object': {
        const properties = (node['properties'] ?? {}) as Record<string, JsonSchema>;
        for (const [name, property] of Object.entries(properties)) {
          visit(property, path ? `${path}.${name}` : name);
        }
        const extra = node['additionalProperties'];
        if (extra && typeof extra === 'object') visit(extra as JsonSchema, `${path}.*`);
        else if (extra === true) problems.push(`${path || '(payload)'}: any extra field`);
        return;
      }
      default:
        problems.push(`${path || '(payload)'}: anything`);
    }
  };

  visit(root, '');
  return problems;
}

/** Every job `defineJob` made, so `addJob` adds no job whose payload went unchecked. */
const definedJobs = new WeakSet<Job>();

/**
 * Defines a job. Throws when the name isn't `<area>.<event>` or the payload could carry free text,
 * so a module with such a job fails as soon as it loads.
 */
export function defineJob<Payload extends JobPayloadSchema>(
  name: string,
  payload: Payload,
): Job<Payload> {
  if (!jobNamePattern.test(name)) {
    throw new InvalidJobError(`Job name "${name}" is not <area>.<event> in snake case.`);
  }
  const problems = payloadProblems(payload);
  if (problems.length > 0) {
    throw new InvalidJobError(
      `The payload of ${name} may carry IDs and small values only:\n  ${problems.join('\n  ')}`,
    );
  }
  const job = { name, payload };
  definedJobs.add(job);
  return job;
}

export interface AddJobOptions {
  /** Run no earlier than this. Defaults to now. */
  runAt?: Date;
  /**
   * Replaces a pending job with the same key, so a burst of changes leaves one job (for example
   * one per Member and Chat). The job keeps the newest payload and `runAt`.
   */
  jobKey?: string;
  /** Attempts before the job fails for good. Graphile Worker's default is 25. */
  maxAttempts?: number;
  /** Lower runs first. Defaults to 0. */
  priority?: number;
}

/**
 * Adds a job inside the transaction of `scope`, so it exists if and only if the change commits
 * (ADR-0008). The payload is checked against the job's schema first.
 */
export async function addJob<Payload extends JobPayloadSchema>(
  scope: TransactionScope,
  job: Job<Payload>,
  payload: z.input<Payload>,
  options: AddJobOptions = {},
): Promise<void> {
  if (!definedJobs.has(job)) {
    throw new InvalidJobError('addJob takes a job made with defineJob, not a name.');
  }
  const parsed = job.payload.safeParse(payload);
  if (!parsed.success) throw new InvalidJobPayloadError(job.name, parsed.error);
  await scope.client.query(
    `select graphile_worker.add_job(
       $1, payload := $2::json, run_at := $3, max_attempts := $4, job_key := $5, priority := $6
     )`,
    [
      job.name,
      JSON.stringify(parsed.data),
      options.runAt ?? null,
      options.maxAttempts ?? null,
      options.jobKey ?? null,
      options.priority ?? null,
    ],
  );
}

/** Structured log lines from a handler; the worker adds the job's name, ID and attempt. */
export type JobLogFunction = (fields: object, message?: string) => void;

export interface JobLog {
  debug: JobLogFunction;
  info: JobLogFunction;
  warn: JobLogFunction;
  error: JobLogFunction;
}

/** What a handler gets besides its payload. */
export interface JobContext {
  readonly db: Database;
  readonly log: JobLog;
  readonly job: {
    readonly id: string;
    readonly name: string;
    /** 1 on the first run. */
    readonly attempt: number;
    readonly maxAttempts: number;
  };
  /** Aborts when the worker is shutting down and the job should stop early if it can. */
  readonly signal: AbortSignal;
}

/**
 * Runs one kind of job. A job can run more than once (after a crash or a retry), so a handler
 * must leave the same result when it runs again: see "Jobs" in the architecture overview.
 */
export interface JobHandler<Payload extends JobPayloadSchema = JobPayloadSchema> {
  readonly job: Job<Payload>;
  run(payload: z.output<Payload>, context: JobContext): Promise<void>;
}

export function handle<Payload extends JobPayloadSchema>(
  job: Job<Payload>,
  run: (payload: z.output<Payload>, context: JobContext) => Promise<void>,
): JobHandler<Payload> {
  return { job, run };
}

/** A job the worker adds on a schedule. Its payload schema must accept an empty object. */
export interface CronSchedule {
  readonly job: Job;
  /** A cron pattern in UTC, such as `0 * * * *` for every hour. */
  readonly match: string;
  /**
   * After the worker was down, add the runs it missed within this many milliseconds.
   * Defaults to none.
   */
  readonly backfillPeriod?: number;
}

/** What a module exports through its public entry point for `apps/worker` to run. */
export interface ModuleJobs {
  readonly handlers: readonly JobHandler[];
  readonly cron?: readonly CronSchedule[];
}
