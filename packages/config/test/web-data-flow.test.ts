// CHK-16: the web data flow doc records what it was checked against, works one example through
// every path data takes into the browser cache, and is linked from the docs index.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const doc = read('docs/architecture/web-data-flow.md');

/** The body under a heading of exactly `level` hashes, up to the next heading of that level or higher. */
function sectionBody(text: string, level: number, heading: string): string {
  const marker = '#'.repeat(level);
  const start = text.indexOf(`\n${marker} ${heading}\n`);
  if (start === -1) throw new Error(`no "${marker} ${heading}" heading`);
  const rest = text.slice(start + heading.length + level + 3);
  const next = new RegExp(`^#{1,${String(level)}} `, 'm').exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

describe('web data flow doc', () => {
  it('is linked from the docs index and the architecture overview', () => {
    expect(read('docs/README.md')).toContain('](architecture/web-data-flow.md)');
    expect(read('docs/architecture/overview.md')).toContain('](web-data-flow.md)');
  });

  describe('is checked against current oRPC 1, TanStack Query 5 and Next.js 16 docs', () => {
    const checked = sectionBody(doc, 2, 'Checked against');

    it('says when and with what it was checked', () => {
      expect(checked).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
      expect(checked).toContain('Context7');
    });

    it.each([
      ['oRPC', '1'],
      ['TanStack Query', '5'],
      ['Next.js', '16'],
    ])('lists %s %s.x with its sources', (library, major) => {
      const row = checked.split('\n').find((line) => line.startsWith(`| ${library}`));
      expect(row, `a row for ${library}`).toBeDefined();
      const [, version = '', sources = ''] = (row ?? '')
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      expect(version).toMatch(new RegExp(`^${major}\\.\\d+\\.\\d+$`));
      expect(sources.length).toBeGreaterThan(20);
    });
  });

  describe('works the example through first load, client navigation, a realtime event and reconnecting', () => {
    const example = sectionBody(doc, 2, 'Worked example: the chat list and an open Chat');

    it.each(['First load', 'Client navigation', 'A realtime event', 'Reconnecting'])(
      'has "%s" with a sequence diagram',
      (step) => {
        expect(sectionBody(example, 3, step)).toMatch(/```mermaid\s*\nsequenceDiagram\n/);
      },
    );
  });
});
