// CHK-17: `pnpm db:reset` drops every module schema, migrates and seeds, and running it twice
// gives the same data (D23: fixed seed data).
import { readdirSync } from 'node:fs';

import { droppableSchemas } from '@chaku/db/migrate';
import { useTestDatabase } from '@chaku/db/testing';
import { describe, expect, it } from 'vitest';

import { resetLocalDatabase } from '../src/database.ts';

const database = useTestDatabase();

/** Every row of every table outside `public` and Drizzle's bookkeeping, in a stable order. */
async function snapshot(): Promise<Record<string, unknown[]>> {
  const db = database.db.$client;
  const { rows: tables } = await db.query<{ name: string }>(
    `select format('%I.%I', schemaname, tablename) as name from pg_tables
     where schemaname not in ('public', 'information_schema', 'drizzle') and schemaname !~ '^pg_'
     order by 1`,
  );
  const result: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    const { rows } = await db.query(`select t.* from ${name} t order by t::text`);
    result[name] = rows;
  }
  return result;
}

describe('pnpm db:reset', () => {
  it('gives the same data when run twice', async () => {
    await resetLocalDatabase(database.db);
    const first = await snapshot();
    await resetLocalDatabase(database.db);
    const second = await snapshot();

    expect(Object.keys(first)).toContain('identity.members');
    expect(first['identity.members']?.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it('drops what was there before, including schemas no migration creates', async () => {
    await database.db.$client.query(`
      create schema leftover;
      create table leftover.rows (id int);
      insert into identity.members (email, email_verified, display_name, status, updated_at)
        values ('stray@example.com', true, '', 'onboarding', now());
    `);
    await resetLocalDatabase(database.db);

    expect(await droppableSchemas(database.db)).not.toContain('leftover');
    const { rows } = await database.db.$client.query(
      `select 1 from identity.members where email = 'stray@example.com'`,
    );
    expect(rows).toEqual([]);
  });

  it('applies every migration', async () => {
    await resetLocalDatabase(database.db);
    const { rows } = await database.db.$client.query<{ count: string }>(
      'select count(*) from drizzle.__drizzle_migrations',
    );
    const migrations = readdirSync(new URL('../../packages/db/migrations', import.meta.url));
    expect(Number(rows[0]?.count)).toBe(migrations.length);
  });
});
