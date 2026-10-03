// The `pg` pool and the Drizzle client over it. `pg` is the driver Graphile Worker uses too, so a
// job can be added with raw SQL inside a Drizzle transaction (ADR-0008, ADR-0011). Apps bundle
// this, so it reads no files.
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core';
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import pg from 'pg';

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

export function databaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  return url;
}
