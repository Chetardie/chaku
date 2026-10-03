import { base, next, node } from '@chaku/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores(['next-env.d.ts', 'playwright-report/', 'test-results/']),
  base,
  node,
  next,
);
