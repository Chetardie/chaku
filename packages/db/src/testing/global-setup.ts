// Vitest global setup for module tests against real Postgres (D19). It runs once per package
// before the workers start: it makes sure the migrated template exists and drops this package's
// worker databases from the last run, so every run starts from the current migrations.
import path from 'node:path';

import type { TestProject } from 'vitest/node';

import { databaseUrl } from '../client.ts';
import { loadLocalEnv } from '../local-env.ts';
import './context.ts';
import { dropDatabases, ensureTemplate } from './databases.ts';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  loadLocalEnv();
  const url = databaseUrl();
  const name = path
    .basename(project.config.root)
    .replaceAll(/[^a-z0-9]+/gi, '_')
    .toLowerCase();
  const prefix = `chaku_test_${name}_`;

  const template = await ensureTemplate(url);
  await dropDatabases(url, prefix);
  project.provide('testDatabase', { url, template, prefix });

  return () => dropDatabases(url, prefix);
}
