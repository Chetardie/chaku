// CHK-17: the transaction helper gives the Drizzle transaction and the `pg` client under it, so
// raw SQL (later `graphile_worker.add_job`, ADR-0008) commits or rolls back with the Drizzle writes.
import { sql } from 'drizzle-orm';
import { integer, pgSchema, text } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { transaction } from '../src/transaction.ts';
import { useTestDatabase } from '../src/testing/index.ts';

const database = useTestDatabase();

// A table of this test's own: @chaku/db owns no tables and imports no module.
const scratch = pgSchema('transaction_test');
const notes = scratch.table('notes', { id: integer().primaryKey(), label: text().notNull() });

beforeEach(async () => {
  await database.db.$client.query(`
    create schema if not exists transaction_test;
    create table if not exists transaction_test.notes (id integer primary key, label text not null);
  `);
});

async function labels(): Promise<string[]> {
  const rows = await database.db.select().from(notes).orderBy(notes.id);
  return rows.map((row) => row.label);
}

describe('transaction', () => {
  it('runs the Drizzle transaction and the raw client on one connection', async () => {
    await transaction(database.db, async ({ tx, client }) => {
      const drizzleSide = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      const rawSide = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
      expect(drizzleSide.rows[0]?.pid).toBe(rawSide.rows[0]?.pid);
    });
  });

  it('commits the Drizzle write and the raw SQL together', async () => {
    const result = await transaction(database.db, async ({ tx, client }) => {
      await tx.insert(notes).values({ id: 1, label: 'from drizzle' });
      await client.query(`insert into transaction_test.notes values (2, 'from raw sql')`);
      return 'done';
    });
    expect(result).toBe('done');
    expect(await labels()).toEqual(['from drizzle', 'from raw sql']);
  });

  it('rolls back both when the work throws', async () => {
    const failing = transaction(database.db, async ({ tx, client }) => {
      await tx.insert(notes).values({ id: 1, label: 'from drizzle' });
      await client.query(`insert into transaction_test.notes values (2, 'from raw sql')`);
      throw new Error('something after the writes failed');
    });
    await expect(failing).rejects.toThrow('something after the writes failed');
    expect(await labels()).toEqual([]);
  });

  it('gives the connection back to the pool either way', async () => {
    const pool = database.db.$client;
    await transaction(database.db, () => Promise.resolve());
    await transaction(database.db, () => Promise.reject(new Error('no'))).catch(() => undefined);
    expect(pool.totalCount - pool.idleCount).toBe(0);
  });
});
