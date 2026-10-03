// CHK-19: the docs people and agents read first know the web app and the adapters exist.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from './setup.ts';

const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

describe('docs', () => {
  it('the local development guide explains running and testing the web app', () => {
    const guide = read('docs/guides/local-development.md');
    expect(guide).toMatch(/^## Web app$/m);
    for (const command of [
      'pnpm dev',
      'pnpm --filter @chaku/web build',
      'pnpm --filter @chaku/web test:e2e',
    ]) {
      expect(guide).toContain(`\`${command}\``);
    }
  });

  it('CLAUDE.md lists the end-to-end command and the new packages', () => {
    const claude = read('CLAUDE.md');
    expect(claude).toMatch(/^\| `pnpm --filter @chaku\/web test:e2e` \|/m);
    expect(claude).toContain('`apps/web`');
    expect(claude).toContain('`packages/adapters`');
    expect(claude).not.toContain('no application code yet');
  });

  it('the Caddyfile no longer calls the web app a placeholder', () => {
    const caddyfile = read('stack/Caddyfile');
    expect(caddyfile).toMatch(/^#\s+web\s+apps\/web\s+3000\s+\(CHK-19\)$/m);
    expect(caddyfile).not.toMatch(/its port is a placeholder/);
  });

  it('the spec layout has the adapters package (spec §5.6)', () => {
    expect(read('docs/messenger-app-spec.md')).toMatch(
      /^ {2}adapters\/ +# logger and vendor adapters/m,
    );
  });

  it('ADR-0011 names the SMTP client, with an amendment note (D45)', () => {
    expect(read('docs/adr/0011-application-libraries-and-versions.md')).toMatch(
      /^\| Email \|.*Nodemailer 10.*_\(amended in CHK-19/m,
    );
  });
});
