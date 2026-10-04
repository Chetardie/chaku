import { databaseTests } from '@chaku/db/testing/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig keeps JSX for Next.js to compile; tests compile it themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // The auth and session tests run against real Postgres (D19).
    ...databaseTests,
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
