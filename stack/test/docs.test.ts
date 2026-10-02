// CHK-14: the local development guide exists and is linked from the docs index and CLAUDE.md.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../src/stack.ts';

const guide = 'docs/guides/local-development.md';
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

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
});
