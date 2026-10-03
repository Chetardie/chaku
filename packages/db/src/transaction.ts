// A Drizzle transaction together with the `pg` client it runs on. Side effects are jobs added in
// the same transaction as the change (ADR-0008); Graphile Worker's `graphile_worker.add_job(...)`
// is raw SQL, so it needs the client, and must commit or roll back with the Drizzle writes.
import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';

import type { Database, Transaction } from './client.ts';

export interface TransactionScope {
  /** The Drizzle transaction. */
  tx: Transaction;
  /** The `pg` client the transaction runs on. Raw SQL sent here is part of the transaction. */
  client: pg.PoolClient;
}

/**
 * Runs `work` in one transaction on one pooled connection. It commits when `work` resolves and
 * rolls back when it throws, for the Drizzle writes and the raw SQL alike.
 */
export async function transaction<T>(
  db: Database,
  work: (scope: TransactionScope) => Promise<T>,
): Promise<T> {
  const client = await db.$client.connect();
  try {
    // Drizzle over a single client (not the pool) begins the transaction on that same client.
    return await drizzle({ client }).transaction((tx) => work({ tx, client }));
  } finally {
    client.release();
  }
}
