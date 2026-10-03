// Vitest config for a package whose tests use Postgres:
//   export default defineConfig({ test: { ...databaseTests } });
import { fileURLToPath } from 'node:url';

export const databaseTests = {
  globalSetup: [fileURLToPath(new URL('global-setup.ts', import.meta.url))],
  // Turborepo runs every package's tests, lint and type check at once, all against one Postgres
  // in Docker. Creating and dropping databases then takes far longer than Vitest's defaults allow.
  testTimeout: 30_000,
  hookTimeout: 30_000,
};
