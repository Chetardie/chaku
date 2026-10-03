// drizzle-kit (`pnpm db:generate`): one migration history for every module schema (D36, ADR-0007).
// Graphile Worker owns `graphile_worker` and migrates it itself, so `schemaFilter` names only the
// module schemas and leaves it out.
import { defineConfig } from 'drizzle-kit';

import {
  migrationsFolder,
  migrationsSchema,
  moduleSchemaGlob,
  moduleSchemas,
} from './src/modules.ts';

export default defineConfig({
  dialect: 'postgresql',
  // drizzle-kit resolves this from packages/db, where `pnpm db:generate` runs it.
  schema: `../../${moduleSchemaGlob}`,
  schemaFilter: moduleSchemas(),
  out: migrationsFolder,
  migrations: { schema: migrationsSchema },
});
