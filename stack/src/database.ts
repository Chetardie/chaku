// `pnpm db:reset` (D23): drops every module schema, migrates from scratch and loads the fixed seed.
// It lives here, not in @chaku/db, because it seeds every module and @chaku/db imports none.
import type { Database } from '@chaku/db';
import { resetDatabase, type Seed } from '@chaku/db/migrate';
import { seedIdentity } from '@chaku/identity';

import { ensureAgentRole } from './agent-role.ts';

/** Every module's seed, in an order that respects their references (by ID) to each other. */
export const seeds: Seed[] = [seedIdentity];

/** Resets and seeds the database, and makes sure the agents' read-only role exists (CHK-24). */
export async function resetLocalDatabase(db: Database): Promise<void> {
  await resetDatabase(db, seeds);
  await ensureAgentRole(db);
}
