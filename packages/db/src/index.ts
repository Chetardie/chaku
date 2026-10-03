// @chaku/db: the shared database plumbing. It owns no tables and imports no module (ADR-0007);
// each module declares its own schema in packages/modules/<name>/src/schema.ts.
export {
  closeDatabase,
  createDatabase,
  type Database,
  databaseUrl,
  loadLocalEnv,
  type Queryable,
  type Transaction,
} from './client.ts';
export { droppableSchemas, migrateDatabase, resetDatabase, type Seed } from './migrate.ts';
export { transaction, type TransactionScope } from './transaction.ts';
