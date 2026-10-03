// @chaku/db/testing: module tests run against real Postgres, never database mocks (D19). Each
// test worker gets its own database, cloned from a migrated template, and every table is emptied
// before each test. Add `databaseTests` from @chaku/db/testing/config to the package's Vitest
// config, then in a test file:
//
//   const database = useTestDatabase();
//   it('stores a Member', async () => { await database.db.insert(members).values(...); });
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

import { closeDatabase, createDatabase, type Database } from '../client.ts';
import './context.ts';
import { databaseUrlFor, ensureClone } from './databases.ts';

export { cloneTemplate, databaseUrlFor, dropDatabases } from './databases.ts';
export type { TestDatabaseContext } from './context.ts';

/** This worker's database name. `VITEST_POOL_ID` is unique among the workers running at once. */
export function workerDatabaseName(): string {
  const { prefix } = inject('testDatabase');
  return `${prefix}${process.env['VITEST_POOL_ID'] ?? '1'}`;
}

/** Empties every table outside `public`, Postgres's own schemas and Drizzle's migration table. */
export async function clearTables(db: Database): Promise<void> {
  const { rows } = await db.$client.query<{ name: string }>(
    `select format('%I.%I', schemaname, tablename) as name from pg_tables
     where schemaname not in ('public', 'information_schema', 'drizzle') and schemaname !~ '^pg_'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((row) => row.name).join(', ');
  await db.$client.query(`truncate ${tables} restart identity cascade`);
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
