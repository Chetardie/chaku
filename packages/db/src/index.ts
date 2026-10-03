// @chaku/db: the shared database plumbing. It owns no tables and imports no module (ADR-0007);
// each module declares its own schema in packages/modules/<name>/src/schema.ts.
// This entry point is what apps and modules use at runtime, and apps bundle it, so nothing here
// reads files. Migrations and the local environment are in `@chaku/db/migrate`.
export {
  closeDatabase,
  createDatabase,
  type Database,
  databaseUrl,
  type Queryable,
  type Transaction,
} from './client.ts';
export { transaction, type TransactionScope } from './transaction.ts';
