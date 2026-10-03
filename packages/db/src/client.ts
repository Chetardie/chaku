// The `pg` pool and the Drizzle client over it. `pg` is the driver Graphile Worker uses too, so a
// job can be added with raw SQL inside a Drizzle transaction (ADR-0008, ADR-0011).
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { PgAsyncDatabase } from 'drizzle-orm/pg-core';
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { repoRoot } from './modules.ts';

export type Database = NodePgDatabase & { $client: pg.Pool };

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** A Database or a Transaction: what module functions take, so callers choose the transaction. */
export type Queryable = PgAsyncDatabase<NodePgQueryResultHKT>;

export function createDatabase(connectionString: string): Database {
  return drizzle({ client: new pg.Pool({ connectionString }) });
}

/** Closes the pool. Scripts and tests call this so Node.js can exit. */
export async function closeDatabase(db: Database): Promise<void> {
  await db.$client.end();
}

/**
 * Loads `.env`, then fills anything it doesn't set from `.env.example`, like `pnpm stack` does.
 * Only scripts and tests on a developer's machine or in CI call this; deployed apps get their
 * environment from the platform.
 */
export function loadLocalEnv(): void {
  for (const file of ['.env', '.env.example']) {
    const full = path.join(repoRoot, file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
}

export function databaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  return url;
}
