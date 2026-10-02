// Guards the workspace rules from CHK-12 and ADR-0011: one source of versions, and TypeScript 7 for
// type checking while tools still load TypeScript 6.
import { execSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
