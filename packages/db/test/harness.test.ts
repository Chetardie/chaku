// CHK-17: the Vitest harness. Each test worker has its own database, cloned from the migrated
// template, and every table is emptied before each test (D19).
import { afterAll, describe, expect, inject, it } from 'vitest';

import { closeDatabase, createDatabase, type Database } from '../src/client.ts';
import {
  cloneTemplate,
  databaseUrlFor,
  dropDatabases,
  useTestDatabase,
  workerDatabaseName,
} from '../src/testing/index.ts';

const database = useTestDatabase();

async function currentDatabase(db: Database): Promise<string> {
  const { rows } = await db.$client.query<{ name: string }>('select current_database() as name');
  return rows[0]?.name ?? '';
}

describe('the test database', () => {
  it("is this worker's own, named after its pool ID", async () => {
    const { prefix } = inject('testDatabase');
    expect(database.name).toBe(`${prefix}${process.env['VITEST_POOL_ID'] ?? ''}`);
    expect(await currentDatabase(database.db)).toBe(database.name);
  });

  it('is cloned from the migrated template', async () => {
    const { rows } = await database.db.$client.query<{ count: string }>(
      'select count(*) from drizzle.__drizzle_migrations',
    );
    expect(Number(rows[0]?.count)).toBeGreaterThan(0);
  });

  describe('between tests', () => {
    // These two run in order: the second sees what the first left behind, if anything.
    it('lets a test write rows', async () => {
      await database.db.$client.query(`
        create schema if not exists harness_test;
        create table if not exists harness_test.rows (label text);
        insert into harness_test.rows values ('left behind');
      `);
    });

    it('empties every table before the next test', async () => {
      const { rows } = await database.db.$client.query('select * from harness_test.rows');
      expect(rows).toEqual([]);
    });
  });
});

describe('two workers', () => {
  const { url, template, prefix } = inject('testDatabase');
  // Named like worker databases, so the global teardown drops them even if this test fails.
  const names = [`${prefix}isolation_a`, `${prefix}isolation_b`] as const;
  const opened: Database[] = [];

  afterAll(async () => {
    for (const db of opened) await closeDatabase(db);
    for (const name of names) await dropDatabases(url, name);
  });

  it("don't see each other's rows", async () => {
    const [a, b] = await Promise.all(
      names.map(async (name) => {
        await cloneTemplate(url, template, name);
        const db = createDatabase(databaseUrlFor(url, name));
        opened.push(db);
        await db.$client.query('create table public.worker_rows (worker text)');
        return db;
      }),
    );
    if (!a || !b) throw new Error('both databases are created');

    await a.$client.query(`insert into public.worker_rows values ('a')`);
    await b.$client.query(`insert into public.worker_rows values ('b')`);

    const seenByA = await a.$client.query('select worker from public.worker_rows');
    const seenByB = await b.$client.query('select worker from public.worker_rows');
    expect(seenByA.rows).toEqual([{ worker: 'a' }]);
    expect(seenByB.rows).toEqual([{ worker: 'b' }]);
  });

  it('get different database names', () => {
    const original = process.env['VITEST_POOL_ID'];
    try {
      process.env['VITEST_POOL_ID'] = '1';
      const first = workerDatabaseName();
      process.env['VITEST_POOL_ID'] = '2';
      expect(workerDatabaseName()).not.toBe(first);
    } finally {
      if (original === undefined) delete process.env['VITEST_POOL_ID'];
      else process.env['VITEST_POOL_ID'] = original;
    }
  });
});
