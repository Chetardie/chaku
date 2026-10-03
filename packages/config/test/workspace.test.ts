// Guards the workspace rules from CHK-12 and ADR-0011: one source of versions, and TypeScript 7 for
// type checking while tools still load TypeScript 6. CHK-17 adds the exact Drizzle 1.0 RC pin.
import { execSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '../../..');

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
}

/** The `packages:` globs from pnpm-workspace.yaml. */
function workspaceGlobs(): string[] {
  const yaml = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const block = /^packages:\n((?:\s+-\s.+\n)+)/m.exec(yaml)?.[1] ?? '';
  return [...block.matchAll(/-\s+(\S+)/g)].map((match) => match[1] ?? '');
}

function workspacePackageFiles(): string[] {
  const files = workspaceGlobs().flatMap((glob) =>
    globSync(`${glob}/package.json`, { cwd: root }).map((file) => path.join(root, file)),
  );
  return [path.join(root, 'package.json'), ...files];
}

describe('workspace', () => {
  it('finds the workspace packages', () => {
    const names = workspacePackageFiles().map((file) => readJson(file).name);
    expect(names).toContain('chaku');
    expect(names).toContain('@chaku/config');
  });

  it('takes every dependency version from the pnpm catalog', () => {
    const inline: string[] = [];
    for (const file of workspacePackageFiles()) {
      const pkg = readJson(file);
      const groups = [
        pkg.dependencies,
        pkg.devDependencies,
        pkg.peerDependencies,
        pkg.optionalDependencies,
      ];
      for (const group of groups) {
        for (const [name, spec] of Object.entries(group ?? {})) {
          if (!spec.startsWith('catalog:') && spec !== 'workspace:*') {
            inline.push(`${path.relative(root, file)}: ${name}@${spec}`);
          }
        }
      }
    }
    expect(inline).toEqual([]);
  });

  it('pins Drizzle ORM and drizzle-kit to the same exact 1.0 release candidate (ADR-0011)', () => {
    const workspace = parse(readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as {
      catalog: Record<string, string>;
    };
    const orm = workspace.catalog['drizzle-orm'];
    expect(orm).toMatch(/^1\.0\.0-rc\.\d+$/);
    expect(workspace.catalog['drizzle-kit']).toBe(orm);
  });

  it.each([
    // CHK-19: the web app's libraries, at the majors ADR-0011 fixes.
    ['next', 16],
    ['react', 19],
    ['react-dom', 19],
    ['@orpc/server', 1],
    ['@orpc/client', 1],
    ['@orpc/tanstack-query', 1],
    ['@tanstack/react-query', 5],
    ['next-intl', 4],
    ['zod', 4],
    ['pino', 10],
    ['@playwright/test', 1],
  ])('pins %s to major %i (ADR-0011)', (name, major) => {
    const workspace = parse(readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as {
      catalog: Record<string, string>;
    };
    const version = workspace.catalog[name] ?? '';
    expect(version).toMatch(new RegExp(`^\\^?${String(major)}\\.\\d+\\.\\d+$`));
  });

  it('pins oRPC, TanStack Query and Next.js to the versions the web data flow doc was checked against', () => {
    const workspace = parse(readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as {
      catalog: Record<string, string>;
    };
    const doc = readFileSync(path.join(root, 'docs/architecture/web-data-flow.md'), 'utf8');
    const checked = (library: string) =>
      new RegExp(`^\\| ${library}[^|]*\\| (\\d+\\.\\d+\\.\\d+) \\|`, 'm').exec(doc)?.[1];
    expect(workspace.catalog['@orpc/server']).toBe(`^${checked('oRPC') ?? ''}`);
    expect(workspace.catalog['@tanstack/react-query']).toBe(`^${checked('TanStack Query') ?? ''}`);
    expect(workspace.catalog['next']).toBe(`^${checked('Next.js') ?? ''}`);
  });

  it('type checks with TypeScript 7', () => {
    // `pnpm test` puts node_modules/.bin on PATH, the same `tsc` that `pnpm typecheck` runs.
    expect(execSync('tsc --version', { encoding: 'utf8' })).toMatch(/^Version 7\./);
  });

  it('runs `tsc` in every typecheck script', () => {
    for (const file of workspacePackageFiles()) {
      const script = readJson(file).scripts?.['typecheck'];
      if (script === undefined || script.startsWith('turbo ')) continue;
      expect(script, path.relative(root, file)).toMatch(/^tsc(\s|$)/);
    }
  });

  it('gives typescript-eslint TypeScript 6', () => {
    const fromHere = createRequire(import.meta.url);
    const fromPlugin = createRequire(fromHere.resolve('typescript-eslint'));
    const fromParser = createRequire(fromPlugin.resolve('@typescript-eslint/typescript-estree'));
    const ts = fromParser('typescript') as { version: string };
    expect(ts.version).toMatch(/^6\./);
  });
});
