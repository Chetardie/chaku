// Where the module schemas are. Each module in packages/modules/<name> declares its tables in
// src/schema.ts with pgSchema('<name>') (ADR-0007); all of them share one migration history (D36).
import { globSync } from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

/** The one migration history for every module schema. */
export const migrationsFolder = path.resolve(import.meta.dirname, '../migrations');

/** Drizzle's own bookkeeping, outside every module schema. */
export const migrationsSchema = 'drizzle';

/** Every module's schema file, relative to the repo root. */
export const moduleSchemaGlob = 'packages/modules/*/src/schema.ts';

/** Every module's schema file, relative to the repo root, with forward slashes. */
export function moduleSchemaFiles(): string[] {
  return globSync(moduleSchemaGlob, { cwd: repoRoot })
    .map((file) => file.split(path.sep).join('/'))
    .sort();
}

/** The Postgres schema of every module with tables: the module's folder name. */
export function moduleSchemas(): string[] {
  return moduleSchemaFiles().map((file) => file.split('/')[2] ?? '');
}
