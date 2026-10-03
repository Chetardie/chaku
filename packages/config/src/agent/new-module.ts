// The `new-module` skill's scaffold (CHK-24, ADR-0003, ADR-0007, ADR-0008):
//
//   node packages/config/src/agent/new-module.ts <name> "<what the module owns>"
//
// Writes packages/modules/<name> in the shape of `identity`, and registers it where every module is
// listed: the data model doc, the worker's modules and the `pnpm db:reset` seeds. It writes files
// only; the skill (.claude/skills/new-module/SKILL.md) runs `pnpm install`, `pnpm db:generate` and
// the checks after it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import { repoRoot } from './after-edit.ts';

/** A module name is its folder, its package (`@chaku/<name>`) and its Postgres schema. */
const namePattern = /^[a-z][a-z]{1,29}$/;

/** Names a module can't take: Postgres's own schemas and the workspace's other packages. */
const reservedNames = new Set([
  'public',
  'drizzle',
  'adapters',
  'config',
  'content',
  'db',
  'ui',
  'stack',
  'web',
  'worker',
  'realtime',
]);

export class NewModuleError extends Error {
  override name = 'NewModuleError';
}

/** A file to write, relative to the repo root, with its whole new content. */
export interface FileChange {
  path: string;
  content: string;
}

/** Reads a file relative to the repo root, or undefined when it doesn't exist. */
export type ReadFile = (relative: string) => string | undefined;

const capitalize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** The files of the new package. */
function packageFiles(name: string, about: string): FileChange[] {
  const dir = `packages/modules/${name}`;
  const jobs = `${name}Jobs`;
  const seed = `seed${capitalize(name)}`;
  const json = (value: object) => `${JSON.stringify(value, null, 2)}\n`;
  return [
    {
      path: `${dir}/package.json`,
      content: json({
        name: `@chaku/${name}`,
        private: true,
        type: 'module',
        exports: { '.': './src/index.ts' },
        scripts: { lint: 'eslint .', typecheck: 'tsc', test: 'vitest run' },
        dependencies: { '@chaku/db': 'workspace:*', 'drizzle-orm': 'catalog:' },
        devDependencies: {
          '@chaku/config': 'workspace:*',
          '@types/node': 'catalog:',
          '@typescript/native': 'catalog:',
          eslint: 'catalog:',
          typescript: 'catalog:',
          vitest: 'catalog:',
        },
      }),
    },
    {
      path: `${dir}/tsconfig.json`,
      content: `{
  "extends": "@chaku/config/tsconfig/node.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    // Scripts run as TypeScript straight in Node.js, which needs the .ts extension on imports.
    "allowImportingTsExtensions": true
  },
  "include": ["*.js", "*.ts", "src/**/*.ts", "test/**/*.ts"]
}
`,
    },
    {
      path: `${dir}/eslint.config.js`,
      content: `import { base, node } from '@chaku/config/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(base, node);
`,
    },
    {
      path: `${dir}/vitest.config.ts`,
      content: `import { databaseTests } from '@chaku/db/testing/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { ...databaseTests } });
`,
    },
    {
      path: `${dir}/turbo.json`,
      content: `{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {
    "test": {
      // schema.test.ts compares the migrated schema with the data model doc.
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/docs/architecture/data-model.md"]
    }
  }
}
`,
    },
    {
      path: `${dir}/src/index.ts`,
      content: `// ${name}: ${about}. Other code uses this module only through this file (ADR-0003).
export { eraseMember, ${jobs} } from './jobs.ts';
export { ${seed} } from './seed.ts';
`,
    },
    {
      path: `${dir}/src/schema.ts`,
      content: `// The \`${name}\` schema: ${about}. Every table, column, check and index here is listed in
// docs/architecture/data-model.md#${name}, and test/schema.test.ts compares the migrated database
// with that doc. Rows of other modules are referenced by ID only: no foreign key and no join
// leaves this schema (ADR-0007).
import { snakeCase } from 'drizzle-orm/pg-core';

export const ${name} = snakeCase.schema('${name}');
`,
    },
    {
      path: `${dir}/src/jobs.ts`,
      content: `// ${name}'s jobs (ADR-0008). apps/worker runs them; they reach it through src/index.ts.
import type { ModuleJobs, Queryable } from '@chaku/db';

type ErasureStep = (db: Queryable, memberId: string) => Promise<void>;

/**
 * One step for each table that stores Member data, as the Erasure table in
 * docs/architecture/data-model.md#${name} says (ADR-0007). Each must leave the same result when it
 * runs again: a job can run more than once.
 */
const erasureSteps: ErasureStep[] = [];

/**
 * Erases what this module stores about a Member, for \`member.erasure_requested\` (ADR-0007). Not
 * wired to that event yet: the worker can't deliver one event to several modules (CHK-42).
 */
export async function eraseMember(db: Queryable, memberId: string): Promise<void> {
  for (const step of erasureSteps) await step(db, memberId);
}

export const ${jobs}: ModuleJobs = { handlers: [] };
`,
    },
    {
      path: `${dir}/src/seed.ts`,
      content: `// The fixed local seed for ${name} (D23): fake data only, never real people or emails (ADR-0013),
// with fixed IDs and times so \`pnpm db:reset\` always gives the same data. It runs after identity's
// seed, so rows can refer to the seed Members by ID.
import type { Queryable } from '@chaku/db';

type SeedStep = (db: Queryable) => Promise<void>;

/** Inserts, one table at a time, in an order that respects the foreign keys. */
const seedSteps: SeedStep[] = [];

export async function ${seed}(db: Queryable): Promise<void> {
  for (const step of seedSteps) await step(db);
}
`,
    },
    {
      path: `${dir}/test/schema.test.ts`,
      content: `// The migrated \`${name}\` schema is the one in docs/architecture/data-model.md#${name}: every
// table, column, foreign key, check and index in the doc, and nothing more.
import { describeDataModelSchema, useTestDatabase } from '@chaku/db/testing';

const database = useTestDatabase();

describeDataModelSchema('${name}', database);
`,
    },
    {
      path: `${dir}/test/jobs.test.ts`,
      content: `// ${name}'s jobs and Member erasure, run the way apps/worker runs them (ADR-0007, ADR-0008).
import { payloadProblems } from '@chaku/db';
import { queuedJobs, useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { eraseMember, ${jobs}, ${seed} } from '../src/index.ts';

const database = useTestDatabase();

/** A seed Member's ID (identity's seed). */
const memberId = '019b76da-a800-7000-8000-000000000002';

beforeEach(async () => {
  await ${seed}(database.db);
});

describe('eraseMember', () => {
  it('leaves the same state when it runs twice, and adds no job', async () => {
    await eraseMember(database.db, memberId);
    await eraseMember(database.db, memberId);
    expect(await queuedJobs(database.db)).toEqual([]);
  });
});

describe('${jobs}', () => {
  it('carry IDs and small values only in every payload (D9)', () => {
    for (const { job } of ${jobs}.handlers) expect(payloadProblems(job.payload)).toEqual([]);
  });
});
`,
    },
  ];
}

/** The module's section of the data model doc. */
function docSection(name: string, about: string): string {
  return `## \`${name}\`

${about.charAt(0).toUpperCase()}${about.slice(1)}.

No tables yet. Each table gets a section here in the shape of [identity](#identity), in the same branch as its migration (the \`new-migration\` skill).

### Erasure

| Table | On \`member.erasure_requested\` |
|---|---|

`;
}

/** Adds the module's section before the sections that follow the modules, unless it has one. */
function withDocSection(doc: string, name: string, about: string): string | undefined {
  if (new RegExp(`^## \`${name}\`$`, 'm').test(doc)) return undefined;
  const next = ['## Ranking', '## List screens', '## Review decisions']
    .map((heading) => doc.search(new RegExp(`^${heading}$`, 'm')))
    .find((index) => index >= 0);
  if (next === undefined)
    throw new NewModuleError('The data model doc has no "## Review decisions".');
  return doc.slice(0, next) + docSection(name, about) + doc.slice(next);
}

/** Adds `import { what } from '@chaku/<name>';` and puts `what` at the end of `list`'s array. */
function withRegistration(
  source: string,
  file: string,
  name: string,
  what: string,
  list: string,
): string {
  const imports = [...source.matchAll(/^import .* from '@chaku\/[^']+';$/gm)];
  const last = imports.at(-1);
  if (!last) throw new NewModuleError(`${file} imports no @chaku package.`);
  const at = last.index + last[0].length;
  const withImport = `${source.slice(0, at)}\nimport { ${what} } from '@chaku/${name}';${source.slice(at)}`;
  const array = new RegExp(`(export const ${list}: [^=]+= \\[)([^\\]]*)(\\])`);
  if (!array.test(withImport)) throw new NewModuleError(`${file} has no ${list} array.`);
  return withImport.replace(array, (_, open: string, items: string, close: string) => {
    const trimmed = items.trim().replace(/,$/, '');
    return `${open}${trimmed ? `${trimmed}, ` : ''}${what}${close}`;
  });
}

/** Adds `@chaku/<name>` to a package.json's dependencies, keeping them sorted. */
function withDependency(manifest: string, name: string): string {
  const pkg = JSON.parse(manifest) as { dependencies?: Record<string, string> };
  const dependencies = { ...pkg.dependencies, [`@chaku/${name}`]: 'workspace:*' };
  pkg.dependencies = Object.fromEntries(
    Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/**
 * Every file the scaffold writes for module `name`. Throws `NewModuleError` for a bad name, a
 * module that exists, or a registration file that changed shape.
 */
export function planNewModule(name: string, about: string, read: ReadFile): FileChange[] {
  if (!namePattern.test(name) || reservedNames.has(name)) {
    throw new NewModuleError(
      `"${name}" can't be a module name: use 2-30 lowercase letters, not a package that exists.`,
    );
  }
  if (about.trim() === '') throw new NewModuleError('Say in a few words what the module owns.');
  if (read(`packages/modules/${name}/package.json`) !== undefined) {
    throw new NewModuleError(`packages/modules/${name} exists already.`);
  }
  const need = (file: string) => {
    const text = read(file);
    if (text === undefined) throw new NewModuleError(`${file} is missing.`);
    return text;
  };
  const changes = packageFiles(name, about.trim().replace(/\.$/, ''));

  const docFile = 'docs/architecture/data-model.md';
  const doc = withDocSection(need(docFile), name, about.trim().replace(/\.$/, ''));
  if (doc !== undefined) changes.push({ path: docFile, content: doc });

  const registrations = [
    {
      file: 'apps/worker/src/modules.ts',
      manifest: 'apps/worker/package.json',
      what: `${name}Jobs`,
      list: 'modules',
    },
    {
      file: 'stack/src/database.ts',
      manifest: 'stack/package.json',
      what: `seed${capitalize(name)}`,
      list: 'seeds',
    },
  ];
  for (const { file, manifest, what, list } of registrations) {
    changes.push({ path: file, content: withRegistration(need(file), file, name, what, list) });
    changes.push({ path: manifest, content: withDependency(need(manifest), name) });
  }
  return changes;
}

/** Writes the changes, formatting code and config with the repo's Prettier settings. */
export async function applyChanges(changes: FileChange[], root = repoRoot): Promise<void> {
  for (const change of changes) {
    const file = path.join(root, change.path);
    let content = change.content;
    if (!file.endsWith('.md')) {
      const options = await prettier.resolveConfig(file);
      content = await prettier.format(content, { ...options, filepath: file });
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

if (import.meta.main) {
  const [name = '', about = ''] = process.argv.slice(2);
  const read: ReadFile = (relative) => {
    const file = path.join(repoRoot, relative);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  };
  try {
    const changes = planNewModule(name, about, read);
    await applyChanges(changes);
    console.log(`Wrote packages/modules/${name} and registered it:`);
    for (const change of changes) console.log(`  ${change.path}`);
    console.log(`
Next (the new-module skill):
  pnpm install
  pnpm db:generate --name ${name}_schema
  pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries`);
  } catch (error) {
    console.error(error instanceof NewModuleError ? error.message : error);
    console.error(
      'Usage: node packages/config/src/agent/new-module.ts <name> "<what the module owns>"',
    );
    process.exitCode = 1;
  }
}
