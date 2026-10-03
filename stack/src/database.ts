// `pnpm db:reset` (D23): drops every module schema, migrates from scratch and loads the fixed seed.
// It lives here, not in @chaku/db, because it seeds every module and @chaku/db imports none.
import { type Database, resetDatabase, type Seed } from '@chaku/db';
import { seedIdentity } from '@chaku/identity';

/** Every module's seed, in an order that respects their references (by ID) to each other. */
export const seeds: Seed[] = [seedIdentity];

export async function resetLocalDatabase(db: Database): Promise<void> {
  await resetDatabase(db, seeds);
}
