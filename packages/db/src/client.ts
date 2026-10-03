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

export interface DatabaseOptions {
  /**
   * Called when an idle connection fails, for example when Postgres restarts. Without a handler
   * that error would end the process; the pool drops the connection and opens another when needed.
   */
  onError?: (error: Error) => void;
}

export function createDatabase(connectionString: string, options: DatabaseOptions = {}): Database {
  const onError =
    options.onError ??
    ((error: Error) => {
      console.error(`Postgres connection error: ${error.message}`);
    });
  const pool = new pg.Pool({ connectionString });
  // Idle connections report errors on the pool, checked-out ones on the client itself.
  pool.on('error', onError);
  pool.on('connect', (client) => client.on('error', onError));
  return drizzle({ client: pool });
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
