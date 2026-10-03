// @chaku/db: the shared database plumbing. It owns no tables and imports no module (ADR-0007);
// each module declares its own schema in packages/modules/<name>/src/schema.ts.
// This entry point is what apps and modules use at runtime, and apps bundle it, so nothing here
// reads files. It also defines and adds jobs (ADR-0008); only apps/worker runs them.
// Migrations and the local environment are in `@chaku/db/migrate`.
export {
  closeDatabase,
  createDatabase,
  type Database,
  type DatabaseOptions,
  databaseUrl,
  type Queryable,
  type Transaction,
} from './client.ts';
export { transaction, type TransactionScope } from './transaction.ts';
export {
  addJob,
  type AddJobOptions,
  type CronSchedule,
  defineJob,
  handle,
  InvalidJobError,
  InvalidJobPayloadError,
  type Job,
  type JobContext,
  type JobHandler,
  type JobLog,
  type JobLogFunction,
  type JobPayloadSchema,
  type ModuleJobs,
  payloadProblems,
} from './jobs.ts';
