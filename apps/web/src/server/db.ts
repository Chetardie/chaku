// The web app's database client: one pool per server process (ADR-0011).
import { createDatabase, type Database } from '@chaku/db';

import { serverEnv } from '../env.ts';

// Kept on globalThis so development reloads don't open a new pool each time.
const store = globalThis as { chakuDatabase?: Database };

export function database(): Database {
  store.chakuDatabase ??= createDatabase(serverEnv().DATABASE_URL);
  return store.chakuDatabase;
}
