// CHK-15: the data model doc follows module data ownership (ADR-0003, ADR-0007). The doc writes
// tables in a fixed shape, so these checks read it like data: `FK →` stays inside a schema,
// `ID →` crosses schemas, every CONTEXT.md term has a home, and every list screen has its indexes.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const docFile = 'docs/architecture/data-model.md';
const doc = read(docFile);

/** Modules that own tables (spec §5.2). `search` and the sync check own none. */
const modulesWithTables = [
  'identity',
  'chat',
  'games',
  'results',
  'feed',
  'notifications',
  'moderation',
];

/** Screens the ticket names; each must be served by one module's indexes. */
const requiredScreens = ['Chat list', 'Feed Hot', 'Feed New', 'Feed Top', 'Comments Best'];

interface Section {
  heading: string;
  body: string;
}

/** Splits `text` at headings of exactly `level` hashes. */
function sections(text: string, level: number): Section[] {
  const marker = '#'.repeat(level);
  const parts = text.split(new RegExp(`^${marker} `, 'm')).slice(1);
  return parts.map((part) => {
    const newline = part.indexOf('\n');
    return { heading: part.slice(0, newline).trim(), body: part.slice(newline + 1) };
  });
}

function section(heading: string): Section {
  const found = sections(doc, 2).find((s) => s.heading === heading);
  if (!found) throw new Error(`${docFile} has no "## ${heading}" section`);
  return found;
}

/** Rows of the first Markdown table in `text`, without the header and separator. */
function tableRows(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('|'));
  if (start === -1) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

const backticked = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');

interface Table {
  schema: string;
  name: string;
  body: string;
}

interface Module {
  name: string;
  body: string;
  tables: Table[];
}

/** `## \`chat\`` sections, each with its `#### \`chat.messages\`` tables. */
const modules: Module[] = sections(doc, 2).flatMap(({ heading, body }) => {
  const name = /^`(\w+)`/.exec(heading)?.[1];
  if (!name) return [];
  const tables = sections(body, 4).flatMap((table) => {
    const match = /^`(\w+)\.(\w+)`$/.exec(table.heading);
    if (!match) return [];
    // A table's text ends at the next heading of any level.
    const own = table.body.split(/^#{2,4} /m)[0] ?? '';
    return [{ schema: match[1] ?? '', name: match[2] ?? '', body: own }];
  });
  return [{ name, body, tables }];
});

const allTables = new Set(modules.flatMap((m) => m.tables.map((t) => `${t.schema}.${t.name}`)));

/** Index and key names a module declares: lines like "- `messages_chat_seq_key`: …". */
const declaredIndexes = (module: Module) =>
  new Set([...module.body.matchAll(/^- `(\w+)`:/gm)].map((m) => m[1]));

/** Entity names in a module's Mermaid ER diagram. */
function erEntities(module: Module): Set<string> {
  const diagram = /```mermaid\s*\nerDiagram\n([\s\S]*?)```/.exec(module.body)?.[1] ?? '';
  const names = new Set<string>();
  for (const line of diagram.split('\n')) {
    const relation = /^\s*(\w+)\s+\S*--\S*\s+(\w+)\s*:/.exec(line);
    if (relation) {
      names.add(relation[1] ?? '');
      names.add(relation[2] ?? '');
    }
    const entity = /^\s*(\w+)\s*\{/.exec(line);
    if (entity) names.add(entity[1] ?? '');
  }
  return names;
}

describe('data model doc', () => {
  it('is linked from the docs index and the architecture overview', () => {
    expect(read('docs/README.md')).toContain('](architecture/data-model.md)');
    expect(read('docs/architecture/overview.md')).toContain('](data-model.md)');
  });

  it('has a section with tables for every module that owns data', () => {
    for (const name of modulesWithTables) {
      const module = modules.find((m) => m.name === name);
      expect(module, `## \`${name}\``).toBeDefined();
      expect(module?.tables.length, `tables in ${name}`).toBeGreaterThan(0);
    }
  });

  it('gives every CONTEXT.md term an owning table or an explicit "not stored"', () => {
    const context = read('CONTEXT.md');
    const language = context.slice(
      context.indexOf('## Language'),
      context.indexOf('## Relationships'),
    );
    const terms = [...language.matchAll(/^\*\*(.+?)\*\*:$/gm)].map((m) => m[1] ?? '');
    expect(terms.length).toBeGreaterThan(30);

    const index = new Map(
      tableRows(section('Entities').body).map(([term, stored]) => [term, stored ?? '']),
    );
    for (const term of terms) {
      const stored = index.get(term);
      expect(stored, `"${term}" in the Entities table`).toBeDefined();
      if (stored === 'not stored') continue;
      const refs = backticked(stored ?? '').map((ref) => ref.split('.').slice(0, 2).join('.'));
      expect(refs.length, `"${term}" names a table`).toBeGreaterThan(0);
      for (const ref of refs) expect(allTables, `"${term}" → ${ref}`).toContain(ref);
    }
  });

  describe('no foreign key crosses module schemas', () => {
    for (const module of modules) {
      it(`keeps ${module.name}'s foreign keys inside its schema`, () => {
        for (const table of module.tables) {
          expect(table.schema, `${table.schema}.${table.name} is in ## \`${module.name}\``).toBe(
            module.name,
          );
          for (const [fk, schema = '', name = ''] of table.body.matchAll(
            /FK[^→\n]*→\s*`(\w+)\.(\w+)/g,
          )) {
            expect(schema, `FK in ${table.schema}.${table.name}: ${fk}`).toBe(module.name);
            expect(allTables).toContain(`${schema}.${name}`);
          }
          for (const [ref, schema = '', name = ''] of table.body.matchAll(
            /ID →\s*`(\w+)\.(\w+)/g,
          )) {
            // A reference inside the same schema should be a real foreign key.
            expect(schema, `ID reference in ${table.schema}.${table.name}: ${ref}`).not.toBe(
              module.name,
            );
            expect(allTables).toContain(`${schema}.${name}`);
          }
        }
      });

      it(`draws only ${module.name}'s own tables, all of them, in its ER diagram`, () => {
        const own = module.tables.map((t) => t.name).sort();
        expect([...erEntities(module)].sort()).toEqual(own);
      });
    }
  });

  it("lists every table holding Member data in its module's erasure table (ADR-0007)", () => {
    for (const module of modules) {
      const erasure = sections(module.body, 3).find((s) => s.heading === 'Erasure');
      const handled = new Set(
        tableRows(erasure?.body ?? '').map(([table]) => backticked(table ?? '')[0]),
      );
      for (const table of module.tables) {
        if (!table.body.includes('`identity.members.id`')) continue;
        expect(handled, `erasure of ${table.schema}.${table.name}`).toContain(
          `${table.schema}.${table.name}`,
        );
      }
    }
  });

  it("serves each list screen from one module's indexes", () => {
    const rows = tableRows(section('List screens').body);
    for (const screen of requiredScreens) {
      expect(rows.map(([name]) => name)).toContain(screen);
    }
    for (const [screen = '', moduleName = '', , indexes = ''] of rows) {
      const module = modules.find((m) => m.name === moduleName);
      expect(module, `module of "${screen}"`).toBeDefined();
      if (!module) continue;
      const declared = declaredIndexes(module);
      for (const index of backticked(indexes)) {
        expect(declared, `"${screen}" uses ${index}, declared in ${moduleName}`).toContain(index);
      }
    }
  });

  it('ends with numbered open questions for review', () => {
    const last = sections(doc, 2).at(-1);
    expect(last?.heading).toBe('Open questions');
    expect(last?.body).toMatch(/^1\. \*\*/m);
  });
});
