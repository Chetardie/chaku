// CHK-14: the local development guide exists and is linked from the docs index and CLAUDE.md.
// CHK-17: both list the database commands.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../src/stack.ts';

const guide = 'docs/guides/local-development.md';
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

const readRootScripts = () =>
  (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

describe('local development guide', () => {
  it('exists', () => {
    expect(existsSync(path.join(repoRoot, guide))).toBe(true);
  });

  it.each([
    ['docs/README.md', 'guides/local-development.md'],
    ['CLAUDE.md', 'docs/guides/local-development.md'],
  ])('is linked from %s', (file, link) => {
    expect(read(file)).toContain(`](${link})`);
  });

  it('covers trusting the root certificate on Windows, macOS and Linux', () => {
    const text = read(guide);
    for (const os of ['Windows', 'macOS', 'Linux']) expect(text).toContain(`### ${os}`);
  });

  it('has the anchor `pnpm stack` points to', () => {
    expect(read(guide)).toMatch(/^## Trust the local certificate$/m);
  });

  // CHK-17: the database commands are where people and agents look for commands.
  it.each([guide, 'CLAUDE.md'])('lists pnpm db:migrate and pnpm db:reset in %s', (file) => {
    const text = read(file);
    for (const command of ['db:migrate', 'db:reset']) {
      expect(text).toMatch(new RegExp(`^\\| \`pnpm ${command}\` \\|`, 'm'));
      expect(readRootScripts()).toHaveProperty(command);
    }
  });
});

// CHK-24: the agent tools are described where agents and people look for them.
describe('agent tools', () => {
  it.each(['docs/process/workflow.md', 'CLAUDE.md'])(
    '%s describes the Postgres MCP and both skills',
    (file) => {
      const text = read(file);
      expect(text).toMatch(/Postgres MCP|`postgres` MCP/);
      expect(text).toContain('chaku_readonly');
      for (const skill of ['new-module', 'new-migration']) {
        expect(text).toContain(`\`${skill}\``);
        expect(existsSync(path.join(repoRoot, `.claude/skills/${skill}/SKILL.md`))).toBe(true);
      }
    },
  );

  it('the local development guide covers the Postgres MCP', () => {
    expect(read(guide)).toMatch(/^### Postgres MCP$/m);
  });
});
