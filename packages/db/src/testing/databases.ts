// Database admin for the test harness: a migrated template, and one clone of it per test worker.
// Statements that create or drop databases go through the DATABASE_URL database. Turborepo runs
// several packages' tests at the same time, so building the template holds an advisory lock;
// clones and drops each have a database name of their own and need none.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';

import { closeDatabase, createDatabase } from '../client.ts';
import { migrateDatabase } from '../migrate.ts';
import { migrationsFolder } from '../modules.ts';

/** Held while building the template. Any constant works; this one spells "chaku". */
const adminLock = 0x63_68_61_6b_75;

const templatePrefix = 'chaku_template_';

/** Names a database on the same server as `url`. */
export function databaseUrlFor(url: string, database: string): string {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
}

/** The template's name changes with the migrations, so a new migration gets a new template. */
export function templateName(): string {
  const hash = createHash('sha256');
  for (const folder of readdirSync(migrationsFolder).sort()) {
    hash.update(folder);
    hash.update(readFileSync(path.join(migrationsFolder, folder, 'migration.sql')));
  }
  return templatePrefix + hash.digest('hex').slice(0, 12);
}

/** Runs `work` on a connection to the DATABASE_URL database. */
async function asAdmin<T>(
  url: string,
  work: (client: pg.Client) => Promise<T>,
  { locked = false } = {},
): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (locked) await client.query('select pg_advisory_lock($1)', [adminLock]);
    return await work(client);
  } finally {
    await client.end();
  }
}

async function exists(client: pg.Client, database: string): Promise<boolean> {
  const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [
    database,
  ]);
  return rowCount === 1;
}

async function drop(client: pg.Client, database: string): Promise<void> {
  if (!(await exists(client, database))) return;
  // A template can't be dropped until it is an ordinary database again.
  await client.query(`alter database "${database}" is_template false`);
  await client.query(`drop database "${database}" with (force)`);
}

/**
 * Creates the migrated template if this set of migrations has none yet, and drops the templates
 * of older migrations. It is built under another name and then renamed, so a failed run leaves
 * no half-migrated template behind.
 */
export async function ensureTemplate(url: string): Promise<string> {
  const template = templateName();
  await asAdmin(
    url,
    async (client) => {
      if (await exists(client, template)) return;
      const building = `${template}_building`;
      await drop(client, building);
      await client.query(`create database "${building}"`);
      const db = createDatabase(databaseUrlFor(url, building));
      try {
        await migrateDatabase(db);
      } finally {
        await closeDatabase(db);
      }
      await client.query(`alter database "${building}" rename to "${template}"`);
      // Nobody connects to the template, so cloning it never waits for a session to end.
      await client.query(
        `alter database "${template}" with is_template true allow_connections false`,
      );

      const { rows } = await client.query<{ name: string }>(
        'select datname as name from pg_database where starts_with(datname, $1) and datname <> $2',
        [templatePrefix, template],
      );
      for (const { name } of rows) await drop(client, name);
    },
    { locked: true },
  );
  return template;
}

/** A fresh copy of `template` called `database`, replacing any database of that name. */
export async function cloneTemplate(
  url: string,
  template: string,
  database: string,
): Promise<void> {
  await asAdmin(url, async (client) => {
    await drop(client, database);
    await client.query(`create database "${database}" template "${template}"`);
  });
}

/** Creates `database` from `template` unless it exists already. */
export async function ensureClone(url: string, template: string, database: string): Promise<void> {
  await asAdmin(url, async (client) => {
    if (await exists(client, database)) return;
    await client.query(`create database "${database}" template "${template}"`);
  });
}

/** Drops every database whose name starts with `prefix`. */
export async function dropDatabases(url: string, prefix: string): Promise<void> {
  await asAdmin(url, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      'select datname as name from pg_database where starts_with(datname, $1)',
      [prefix],
    );
    for (const { name } of rows) await drop(client, name);
  });
}
