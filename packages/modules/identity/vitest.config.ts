import { databaseTests } from '@chaku/db/testing/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { ...databaseTests } });
