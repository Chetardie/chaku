// @chaku/db/testing: module tests run against real Postgres, never database mocks (D19). Each
// test worker gets its own database, cloned from a migrated template, and every table and the job
// queue are emptied before each test. Add `databaseTests` from @chaku/db/testing/config to the
// package's Vitest config, then in a test file:
//
//   const database = useTestDatabase();
//   it('stores a Member', async () => { await database.db.insert(members).values(...); });
//   it('adds the job', async () => { expect(await queuedJobs(database.db)).toMatchObject([...]); });
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

import type { z } from 'zod';

import { closeDatabase, createDatabase, type Database } from '../client.ts';
import {
  InvalidJobPayloadError,
  type Job,
  type JobLog,
  type JobPayloadSchema,
  type ModuleJobs,
} from '../jobs.ts';
import './context.ts';
import { databaseUrlFor, ensureClone } from './databases.ts';

export { cloneTemplate, databaseUrlFor, dropDatabases } from './databases.ts';
export type { TestDatabaseContext } from './context.ts';

/** This worker's database name. `VITEST_POOL_ID` is unique among the workers running at once. */
export function workerDatabaseName(): string {
  const { prefix } = inject('testDatabase');
  return `${prefix}${process.env['VITEST_POOL_ID'] ?? '1'}`;
}

/**
 * Graphile Worker's tables that hold queue state (ADR-0008). The rest of its schema, such as its
 * migration table, stays, or the worker would try to install itself again.
 */
const jobTables = ['_private_jobs', '_private_job_queues', '_private_known_crontabs'].map(
  (table) => `graphile_worker.${table}`,
);

/**
 * Empties every table outside `public`, Postgres's own schemas and Drizzle's migration table, and
 * empties the job queue.
 */
export async function clearTables(db: Database): Promise<void> {
  const { rows } = await db.$client.query<{ name: string }>(
    `select format('%I.%I', schemaname, tablename) as name from pg_tables
     where schemaname not in ('public', 'information_schema', 'drizzle', 'graphile_worker')
       and schemaname !~ '^pg_'`,
  );
  const tables = [...rows.map((row) => row.name), ...jobTables].join(', ');
  await db.$client.query(`truncate ${tables} restart identity cascade`);
}

/** Discards a handler's log lines. */
const silentLog: JobLog = { debug() {}, info() {}, warn() {}, error() {} };

/**
 * Runs a module's handler for `job` once, as the worker would: the payload is checked first, and
 * the handler gets this database. Run it twice to show the handler is idempotent (ADR-0008).
 */
export async function runJob<Payload extends JobPayloadSchema>(
  db: Database,
  jobs: ModuleJobs,
  job: Job<Payload>,
  payload: z.input<Payload>,
  attempt = 1,
): Promise<void> {
  const handler = jobs.handlers.find((candidate) => candidate.job === job);
  if (!handler) throw new Error(`The module has no handler for ${job.name}.`);
  const parsed = job.payload.safeParse(payload);
  if (!parsed.success) throw new InvalidJobPayloadError(job.name, parsed.error);
  await handler.run(parsed.data, {
    db,
    log: silentLog,
    job: { id: '1', name: job.name, attempt, maxAttempts: 25 },
    signal: new AbortController().signal,
  });
}

/** A job waiting in the queue, as a module test sees it. */
export interface QueuedJob {
  name: string;
  payload: unknown;
  runAt: Date;
  jobKey: string | null;
  maxAttempts: number;
  priority: number;
  attempts: number;
}

/** The jobs in the queue, oldest first: what the transactions in a test added (ADR-0008). */
export async function queuedJobs(db: Database): Promise<QueuedJob[]> {
  const { rows } = await db.$client.query<QueuedJob>(
    // The public `jobs` view leaves out the payload, so read Graphile Worker's own tables.
    `select tasks.identifier as name, jobs.payload, jobs.run_at as "runAt", jobs.key as "jobKey",
            jobs.max_attempts as "maxAttempts", jobs.priority, jobs.attempts
     from graphile_worker._private_jobs jobs
     join graphile_worker._private_tasks tasks on tasks.id = jobs.task_id
     order by jobs.id`,
  );
  return rows;
}

export interface TestDatabase {
  /** This worker's database. Ready inside tests and hooks, not at the top level of the file. */
  readonly db: Database;
  /** Its name, for the tests of the harness itself. */
  readonly name: string;
}

/** Connects this test file to the worker's database and empties its tables before each test. */
export function useTestDatabase(): TestDatabase {
  let db: Database | undefined;
  const name = workerDatabaseName();

  beforeAll(async () => {
    const { url, template } = inject('testDatabase');
    await ensureClone(url, template, name);
    db = createDatabase(databaseUrlFor(url, name));
  });

  beforeEach(async () => {
    if (db) await clearTables(db);
  });

  afterAll(async () => {
    if (db) await closeDatabase(db);
  });

  return {
    get db() {
      if (!db) throw new Error('The test database is ready only inside tests and hooks.');
      return db;
    },
    name,
  };
}
