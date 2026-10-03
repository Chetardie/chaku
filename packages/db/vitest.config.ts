import { defineConfig } from 'vitest/config';

import { databaseTests } from './src/testing/config.ts';

export default defineConfig({ test: { ...databaseTests } });
