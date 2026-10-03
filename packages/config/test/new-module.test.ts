// CHK-24: the new-module scaffold writes a package in the shape of identity and registers it in
// the data model doc, the worker and `pnpm db:reset`. Planned in memory against this checkout's
// files; nothing is written. Running it for real is shown in the CHK-24 pull request.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../src/agent/after-edit.ts';
import {
  type FileChange,
  NewModuleError,
  planNewModule,
  type ReadFile,
} from '../src/agent/new-module.ts';

const readRepo: ReadFile = (relative) => {
  const file = path.join(repoRoot, relative);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

const changes = planNewModule('scratch', 'notes for trying the scaffold', readRepo);
const byPath = new Map(changes.map((change: FileChange) => [change.path, change.content]));
const file = (relative: string) => {
  const content = byPath.get(relative);
  if (content === undefined) throw new Error(`${relative} is not written`);
  return content;
};

describe('the new package', () => {
  it('has the files identity has', () => {
    const own = changes
      .map((change) => change.path)
      .filter((p) => p.startsWith('packages/modules/scratch/'))
      .map((p) => p.slice('packages/modules/scratch/'.length))
      .sort();
    expect(own).toEqual([
      'eslint.config.js',
      'package.json',
      'src/index.ts',
      'src/jobs.ts',
      'src/schema.ts',
      'src/seed.ts',
      'test/jobs.test.ts',
      'test/schema.test.ts',
      'tsconfig.json',
      'turbo.json',
      'vitest.config.ts',
    ]);
    for (const config of ['eslint.config.js', 'tsconfig.json', 'turbo.json', 'vitest.config.ts']) {
      expect(file(`packages/modules/scratch/${config}`), config).toBe(
        readRepo(`packages/modules/identity/${config}`),
      );
    }
  });

  it('is @chaku/scratch with one public entry point and catalog versions', () => {
    const pkg = JSON.parse(file('packages/modules/scratch/package.json')) as {
      name: string;
      exports: Record<string, string>;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.name).toBe('@chaku/scratch');
    expect(pkg.exports).toEqual({ '.': './src/index.ts' });
    expect(pkg.scripts).toEqual({ lint: 'eslint .', typecheck: 'tsc', test: 'vitest run' });
    for (const spec of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(spec).toMatch(/^(catalog:|workspace:\*)$/);
    }
  });

  it('declares its own Postgres schema with snake_case columns', () => {
    expect(file('packages/modules/scratch/src/schema.ts')).toContain(
      "export const scratch = snakeCase.schema('scratch');",
    );
  });

  it('exports its jobs, the erasure stub and its seed from src/index.ts', () => {
    const index = file('packages/modules/scratch/src/index.ts');
    expect(index).toContain("export { eraseMember, scratchJobs } from './jobs.ts';");
    expect(index).toContain("export { seedScratch } from './seed.ts';");
    expect(file('packages/modules/scratch/src/jobs.ts')).toContain('member.erasure_requested');
  });

  it('tests the schema against the data model doc', () => {
    expect(file('packages/modules/scratch/test/schema.test.ts')).toContain(
      "describeDataModelSchema('scratch', database);",
    );
  });
});

describe('registration', () => {
  it('adds a data model section with an Erasure table, before Ranking', () => {
    const doc = file('docs/architecture/data-model.md');
    const section = doc.indexOf('## `scratch`');
    expect(section).toBeGreaterThan(doc.indexOf('## `media`'));
    expect(section).toBeLessThan(doc.indexOf('## Ranking'));
    expect(doc.slice(section)).toMatch(/^### Erasure$/m);
    expect(doc.replace(/## `scratch`[\s\S]*?(?=## Ranking)/, '')).toBe(
      readRepo('docs/architecture/data-model.md'),
    );
  });

  it('leaves the doc alone for a module it already describes', () => {
    const chat = planNewModule('chat', 'Chats and Messages', readRepo);
    expect(chat.map((change) => change.path)).not.toContain('docs/architecture/data-model.md');
  });

  it("adds the module's jobs to the worker", () => {
    const modules = file('apps/worker/src/modules.ts');
    expect(modules).toContain("import { scratchJobs } from '@chaku/scratch';");
    expect(modules).toMatch(
      /export const modules: readonly ModuleJobs\[\] = \[[^\]]*identityJobs, scratchJobs\]/,
    );
    expect(JSON.parse(file('apps/worker/package.json'))).toMatchObject({
      dependencies: { '@chaku/scratch': 'workspace:*' },
    });
  });

  it("adds the module's seed to pnpm db:reset, after identity's", () => {
    const database = file('stack/src/database.ts');
    expect(database).toContain("import { seedScratch } from '@chaku/scratch';");
    expect(database).toMatch(/export const seeds: Seed\[\] = \[seedIdentity, seedScratch\]/);
    expect(JSON.parse(file('stack/package.json'))).toMatchObject({
      dependencies: { '@chaku/scratch': 'workspace:*' },
    });
  });

  it('keeps package.json dependencies sorted', () => {
    const { dependencies } = JSON.parse(file('stack/package.json')) as {
      dependencies: Record<string, string>;
    };
    const names = Object.keys(dependencies);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('what it refuses', () => {
  it.each(['identity', 'db', 'config', 'web', 'public', 'Chat', 'my_module', 'x', ''])(
    'the name "%s"',
    (name) => {
      expect(() => planNewModule(name, 'something', readRepo)).toThrow(NewModuleError);
    },
  );

  it('a module with no description', () => {
    expect(() => planNewModule('scratch', ' ', readRepo)).toThrow(NewModuleError);
  });
});
