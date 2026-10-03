// `pnpm db:migrate` and `pnpm db:reset`: one migration history for every module schema (D36), then
// Graphile Worker's own schema, so apps can add jobs before the worker has ever run (ADR-0008).
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Logger, runMigrations } from 'graphile-worker';

import type { Database, Transaction } from './client.ts';
import { migrationsFolder, migrationsSchema } from './modules.ts';
import { transaction } from './transaction.ts';

/** Graphile Worker logs each migration step; a migration run only reports failures, by throwing. */
const quiet = new Logger(() => () => undefined);

/**
 * Applies the module migrations this database doesn't have yet, then installs or upgrades the
 * `graphile_worker` schema. Graphile Worker migrates that schema itself; Drizzle never sees it.
 */
export async function migrateDatabase(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder, migrationsSchema });
  await runMigrations({ pgPool: db.$client, logger: quiet });
}

/**
 * Every schema but `public` and Postgres's own: the module schemas, Drizzle's migration table,
 * and Graphile Worker's queue, which `migrateDatabase` installs again.
 */
export async function droppableSchemas(db: Database): Promise<string[]> {
  const { rows } = await db.$client.query<{ name: string }>(
    `select nspname as name from pg_namespace
     where nspname <> 'public' and nspname <> 'information_schema' and nspname !~ '^pg_'
     order by nspname`,
  );
  return rows.map((row) => row.name);
}

export type Seed = (tx: Transaction) => Promise<void>;

/** Drops every module schema, migrates from scratch, then runs `seeds` in one transaction. */
export async function resetDatabase(db: Database, seeds: Seed[] = []): Promise<void> {
  for (const schema of await droppableSchemas(db)) {
    await db.$client.query(`drop schema "${schema}" cascade`);
  }
  await migrateDatabase(db);
  await transaction(db, async ({ tx }) => {
    for (const seed of seeds) await seed(tx);
  });
}
