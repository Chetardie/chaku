// CHK-17: one Drizzle migration history for every module schema (D36, ADR-0007). The first
// migration creates the extensions and the `identity` schema, `pnpm db:migrate` applies only what
// is pending, and no foreign key crosses module schemas.
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, describe, expect, inject, it } from 'vitest';

import drizzleConfig from '../drizzle.config.ts';
import { closeDatabase, createDatabase, type Database } from '../src/client.ts';
import { migrateDatabase } from '../src/migrate.ts';
import { migrationsFolder, migrationsSchema, moduleSchemas } from '../src/modules.ts';
import {
  cloneTemplate,
  databaseUrlFor,
  dropDatabases,
  useTestDatabase,
} from '../src/testing/index.ts';

const database = useTestDatabase();
const migrations = readdirSync(migrationsFolder).sort();

/** A new, empty database for this test file, dropped at the end. */
const scratchDatabases: string[] = [];
async function emptyDatabase(suffix: string): Promise<Database> {
  const { url, prefix } = inject('testDatabase');
  const name = `${prefix}scratch_${suffix}`;
  await cloneTemplate(url, 'template0', name);
  scratchDatabases.push(name);
  return createDatabase(databaseUrlFor(url, name));
}

afterAll(async () => {
  const { url } = inject('testDatabase');
  for (const name of scratchDatabases) await dropDatabases(url, name);
});

async function appliedMigrations(db: Database): Promise<number> {
  const { rows } = await db.$client.query<{ count: string }>(
    `select count(*) from "${migrationsSchema}"."__drizzle_migrations"`,
  );
  return Number(rows[0]?.count);
}

describe('drizzle.config.ts', () => {
  it('collects the schema file of every module', () => {
    expect(moduleSchemas()).toContain('identity');
    expect(drizzleConfig.schema).toBe('../../packages/modules/*/src/schema.ts');
  });

  it('lets drizzle-kit see only the module schemas, not graphile_worker', () => {
    expect(drizzleConfig.schemaFilter).toEqual(moduleSchemas());
    expect(drizzleConfig.schemaFilter).not.toContain('graphile_worker');
  });

  it('writes to the one migration history this package applies', () => {
    expect(drizzleConfig.out).toBe(migrationsFolder);
  });

  it('has a migration for every change in the module schemas', () => {
    // A dry run: drizzle-kit compares the schema files with the last snapshot and writes nothing.
    // `pnpm test` puts node_modules/.bin on PATH.
    const output = execSync('drizzle-kit generate --explain --output json', {
      cwd: path.resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const result = JSON.parse(output) as { status: string };
    expect(result.status, 'run pnpm db:generate').toBe('no_changes');
  });
});

describe('the first migration', () => {
  it('creates pg_trgm and unaccent in public, and the identity schema', async () => {
    const first = migrations[0] ?? '';
    const onlyFirst = mkdtempSync(path.join(tmpdir(), 'chaku-migrations-'));
    cpSync(path.join(migrationsFolder, first), path.join(onlyFirst, first), { recursive: true });

    const db = await emptyDatabase('first');
    try {
      await migrate(db, { migrationsFolder: onlyFirst, migrationsSchema });
      const extensions = await db.$client.query<{ name: string; schema: string }>(
        `select extname as name, extnamespace::regnamespace::text as schema from pg_extension
         where extname in ('pg_trgm', 'unaccent') order by extname`,
      );
      expect(extensions.rows).toEqual([
        { name: 'pg_trgm', schema: 'public' },
        { name: 'unaccent', schema: 'public' },
      ]);
      const schemas = await db.$client.query(
        `select 1 from pg_namespace where nspname = 'identity'`,
      );
      expect(schemas.rowCount).toBe(1);
    } finally {
      await closeDatabase(db);
      rmSync(onlyFirst, { recursive: true, force: true });
    }
  });
});

describe('migrateDatabase (pnpm db:migrate)', () => {
  it('applies every pending migration, then nothing on a second run', async () => {
    const db = await emptyDatabase('migrate');
    try {
      await migrateDatabase(db);
      expect(await appliedMigrations(db)).toBe(migrations.length);
      await migrateDatabase(db);
      expect(await appliedMigrations(db)).toBe(migrations.length);
    } finally {
      await closeDatabase(db);
    }
  });
});

describe('module schemas', () => {
  it('have no foreign key that points into another schema (ADR-0007)', async () => {
    const { rows } = await database.db.$client.query<{
      name: string;
      fromSchema: string;
      toSchema: string;
    }>(
      `select c.conname as name,
              own.relnamespace::regnamespace::text as "fromSchema",
              referenced.relnamespace::regnamespace::text as "toSchema"
       from pg_constraint c
       join pg_class own on own.oid = c.conrelid
       join pg_class referenced on referenced.oid = c.confrelid
       where c.contype = 'f'`,
    );
    // The check must have something to look at, or it would pass on an empty database.
    expect(rows.length).toBeGreaterThan(0);
    const crossing = rows
      .filter((row) => row.fromSchema !== row.toSchema)
      .map((row) => `${row.fromSchema} → ${row.toSchema}: ${row.name}`);
    expect(crossing).toEqual([]);
  });
});
