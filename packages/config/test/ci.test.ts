// Guards the CI rules from CHK-13 and ADR-0013: one required check, a workflow that is safe to run
// on fork PRs, and third-party actions pinned to an exact commit or image digest.
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '../../..');

interface Workflow {
  on: Record<string, unknown>;
  permissions?: unknown;
  jobs: Record<string, { name?: string; if?: string; needs?: string[]; permissions?: unknown }>;
}

const ciFile = path.join(root, '.github/workflows/ci.yml');
const ciText = readFileSync(ciFile, 'utf8');
const ci = parse(ciText) as Workflow;

/** Every workflow and local action, where a `uses:` can appear. */
function actionFiles(): string[] {
  return globSync('.github/**/*.{yml,yaml}', { cwd: root }).map((file) => path.join(root, file));
}

describe('CI workflow', () => {
  it('runs on pull requests and pushes to main, never on pull_request_target', () => {
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push']);
    expect(ci.on['push']).toEqual({ branches: ['main'] });
  });

  it('only reads the repo and uses no secrets', () => {
    expect(ci.permissions).toEqual({ contents: 'read' });
    for (const [id, job] of Object.entries(ci.jobs)) {
      expect(job.permissions, id).toBeUndefined();
    }
    expect(ciText).not.toMatch(/secrets\./);
  });

  it('has one `ci` job that needs every other job and fails unless all of them passed', () => {
    const { ci: gate, ...others } = ci.jobs;
    expect(gate?.name).toBe('ci');
    expect(gate?.if).toBe('${{ always() }}');
    expect([...(gate?.needs ?? [])].sort()).toEqual(Object.keys(others).sort());
    // No other job is named `ci`, so the required check is unambiguous.
    expect(Object.values(others).map((job) => job.name)).not.toContain('ci');
  });

  it('runs lint, typecheck, test and boundaries through Turborepo, and gitleaks', () => {
    expect(ciText).toMatch(/turbo run lint typecheck test depcruise/);
    expect(ciText).toMatch(/docker:\/\/ghcr\.io\/gitleaks\/gitleaks:/);
  });
});

describe('GitHub Actions', () => {
  it('pins every `uses:` to a commit SHA or image digest, with a version comment', () => {
    const unpinned: string[] = [];
    const files = actionFiles();
    expect(files).toContain(ciFile);
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const match = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/.exec(line);
        if (!match) return;
        const [, ref = '', rest = ''] = match;
        const pinned =
          ref.startsWith('./') ||
          /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref) ||
          /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/.test(ref);
        const commented = /#\s*v?\d+(\.\d+)*/.test(rest);
        if (!pinned || (!ref.startsWith('./') && !commented)) {
          unpinned.push(`${path.relative(root, file)}:${String(index + 1)}: ${line.trim()}`);
        }
      });
    }
    expect(unpinned).toEqual([]);
  });
});
