// `pnpm db:migrate`: applies pending migrations to DATABASE_URL (from .env, then .env.example).
// `pnpm db:reset` lives in stack/, because it seeds every module and this package imports none.
import { closeDatabase, createDatabase, databaseUrl } from './client.ts';
import { loadLocalEnv } from './local-env.ts';
import { migrateDatabase } from './migrate.ts';

loadLocalEnv();
const db = createDatabase(databaseUrl());
try {
  await migrateDatabase(db);
  console.log('Migrations applied.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase(db);
}
