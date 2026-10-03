// A module's migrated schema is the one in docs/architecture/data-model.md (CHK-24). The doc writes
// each module's tables in a fixed shape, so this reads it like data: every table, column (type and
// nullability), foreign key, check constraint and index name in the module's section must be in
// the database, and nothing more. A module's test/schema.test.ts calls `describeDataModelSchema`.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Database } from '../client.ts';
import { repoRoot } from '../modules.ts';

export const dataModelFile = path.join(repoRoot, 'docs/architecture/data-model.md');

export interface DataModelColumn {
  name: string;
  /** The doc's type, such as `uuid`, `timestamptz` or `uuid[]`, without `null`. */
  type: string;
  nullable: boolean;
  /** `<table>.<column>` in the same schema when the notes say `FK → …`. */
  references?: string;
}

export interface DataModelTable {
  name: string;
  columns: DataModelColumn[];
  /** Names from the "Keys and indexes" list: `_pkey`, `_key`, `_idx`, `_fkey` and `_check`. */
  keys: string[];
}

/** The doc's type names, as Postgres's `format_type` spells them. Others are spelled the same. */
const postgresTypes: Record<string, string> = {
  timestamptz: 'timestamp with time zone',
  'timestamptz[]': 'timestamp with time zone[]',
};

const escape = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/** The `#### \`<module>.<table>\`` sections of `## \`<module>\``, or none if it has no section. */
export function dataModelTables(
  module: string,
  doc = readFileSync(dataModelFile, 'utf8'),
): DataModelTable[] {
  const section = doc.split(/^## /m).find((part) => part.startsWith(`\`${module}\``)) ?? '';
  const heading = new RegExp(`^\`${escape(module)}\\.(\\w+)\``);
  const foreignKey = new RegExp(`FK → \`${escape(module)}\\.(\\w+\\.\\w+)\``);
  return section
    .split(/^#### /m)
    .slice(1)
    .flatMap((part) => {
      const name = heading.exec(part)?.[1];
      if (!name) return [];
      const body = part.split(/^#{2,4} /m)[0] ?? '';
      const columns = body
        .split(/\r?\n/)
        .filter((line) => line.startsWith('| `'))
        .flatMap((line) => {
          const [names = '', typeCell = '', notes = ''] = line.slice(1, -1).split('|');
          const declared = /`([^`]+)`/.exec(typeCell)?.[1] ?? '';
          const nullable = declared.endsWith(' null');
          const type = nullable ? declared.slice(0, -' null'.length) : declared;
          const references = foreignKey.exec(notes)?.[1];
          return [...names.matchAll(/`(\w+)`/g)].map((match) => ({
            name: match[1] ?? '',
            type,
            nullable,
            ...(references ? { references } : {}),
          }));
        });
      const keys = [...body.matchAll(/^- `(\w+)`:/gm)].map((match) => match[1] ?? '');
      return [{ name, columns, keys }];
    });
}

/** Registers the tests that compare the migrated `module` schema with its section of the doc. */
export function describeDataModelSchema(module: string, database: { readonly db: Database }): void {
  const tables = dataModelTables(module);

  async function query<Row extends object>(text: string, values: unknown[] = []): Promise<Row[]> {
    const { rows } = await database.db.$client.query<Row>(text, values);
    return rows;
  }

  describe(`the migrated ${module} schema`, () => {
    it('exists', async () => {
      expect(await query('select 1 from pg_namespace where nspname = $1', [module])).toHaveLength(
        1,
      );
    });

    it(`has exactly the tables in the data model doc (## \`${module}\`)`, async () => {
      const rows = await query<{ name: string }>(
        `select table_name as name from information_schema.tables where table_schema = $1`,
        [module],
      );
      expect(rows.map((row) => row.name).sort()).toEqual(tables.map((table) => table.name).sort());
    });

    // Vitest refuses `describe.each` with no cases; a module starts with no tables.
    if (tables.length === 0) return;

    describe.each(tables)(`${module}.$name`, (table) => {
      it('has the columns in the doc, with their types and nullability', async () => {
        const rows = await query<{ name: string; type: string; nullable: boolean }>(
          `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
                  not a.attnotnull as nullable
           from pg_attribute a
           where a.attrelid = format('%I.%I', $1::text, $2::text)::regclass
             and a.attnum > 0 and not a.attisdropped
           order by a.attname`,
          [module, table.name],
        );
        const expected = table.columns
          .map((column) => ({
            name: column.name,
            type: postgresTypes[column.type] ?? column.type,
            nullable: column.nullable,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        expect(rows.sort((a, b) => a.name.localeCompare(b.name))).toEqual(expected);
      });

      it(`has the foreign keys in the doc, each inside ${module}`, async () => {
        const rows = await query<{ column: string; target: string }>(
          `select a.attname as column, ref.relname || '.' || refattr.attname as target
           from pg_constraint c
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
           join pg_class ref on ref.oid = c.confrelid
           join pg_attribute refattr on refattr.attrelid = c.confrelid and refattr.attnum = c.confkey[1]
           where c.contype = 'f' and c.conrelid = format('%I.%I', $1::text, $2::text)::regclass
           order by a.attname`,
          [module, table.name],
        );
        const expected = table.columns
          .filter((column) => column.references)
          .map((column) => ({ column: column.name, target: column.references }))
          .sort((a, b) => a.column.localeCompare(b.column));
        expect(rows.sort((a, b) => a.column.localeCompare(b.column))).toEqual(expected);
      });

      it('has the check constraints in the doc', async () => {
        const rows = await query<{ name: string }>(
          `select conname as name from pg_constraint
           where contype = 'c' and conrelid = format('%I.%I', $1::text, $2::text)::regclass
           order by conname`,
          [module, table.name],
        );
        expect(rows.map((row) => row.name).sort()).toEqual(
          table.keys.filter((key) => key.endsWith('_check')).sort(),
        );
      });

      it('has the keys and indexes in the doc', async () => {
        const rows = await query<{ name: string }>(
          `select indexname as name from pg_indexes
           where schemaname = $1 and tablename = $2
           order by indexname`,
          [module, table.name],
        );
        expect(rows.map((row) => row.name).sort()).toEqual(
          table.keys.filter((key) => !key.endsWith('_check') && !key.endsWith('_fkey')).sort(),
        );
      });
    });
  });
}
