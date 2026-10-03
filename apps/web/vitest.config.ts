import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig keeps JSX for Next.js to compile; tests compile it themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
