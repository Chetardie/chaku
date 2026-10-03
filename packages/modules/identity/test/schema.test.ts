// CHK-17: the migrated `identity` schema is the one in docs/architecture/data-model.md#identity.
// Every table, column (with its type and nullability), foreign key, check constraint and index
// name in the doc must be in the database, and nothing more. IDs come from `uuidv7()`.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { useTestDatabase } from '@chaku/db/testing';
import { describe, expect, it } from 'vitest';

import { members } from '../src/schema.ts';

const database = useTestDatabase();

const root = path.resolve(import.meta.dirname, '../../../..');
const doc = readFileSync(path.join(root, 'docs/architecture/data-model.md'), 'utf8');

interface DocColumn {
  name: string;
  type: string;
  nullable: boolean;
  /** `identity.<table>.<column>` when the notes say `FK → …`. */
  references?: string;
}

interface DocTable {
  name: string;
  columns: DocColumn[];
  /** Names from the "Keys and indexes" list: `_pkey`, `_key`, `_idx` and `_check`. */
  keys: string[];
}

/** The doc's types, as `information_schema.columns.data_type` spells them. */
const postgresTypes: Record<string, string> = {
  uuid: 'uuid',
  text: 'text',
  boolean: 'boolean',
  smallint: 'smallint',
  integer: 'integer',
  bigint: 'bigint',
  bytea: 'bytea',
  date: 'date',
  timestamptz: 'timestamp with time zone',
};

/** The `#### \`identity.<table>\`` sections of `## \`identity\``, read like data. */
function docTables(): DocTable[] {
  const section = doc.split(/^## /m).find((part) => part.startsWith('`identity`')) ?? '';
  return section
    .split(/^#### /m)
    .slice(1)
    .map((part) => {
      const body = part.split(/^#{2,4} /m)[0] ?? '';
      const name = /^`identity\.(\w+)`/.exec(part)?.[1] ?? '';
      const columns = body
        .split(/\r?\n/)
        .filter((line) => line.startsWith('| `'))
        .flatMap((line) => {
          const [names = '', type = '', notes = ''] = line.slice(1, -1).split('|');
          const [base = '', nullMarker] = (/`([^`]+)`/.exec(type)?.[1] ?? '').split(' ');
          const references = /FK → `identity\.(\w+\.\w+)`/.exec(notes)?.[1];
          return [...names.matchAll(/`(\w+)`/g)].map((match) => ({
            name: match[1] ?? '',
            type: base,
            nullable: nullMarker === 'null',
            ...(references ? { references } : {}),
          }));
        });
      const keys = [...body.matchAll(/^- `(\w+)`:/gm)].map((match) => match[1] ?? '');
      return { name, columns, keys };
    });
}

const tables = docTables();

async function query<Row extends object>(text: string): Promise<Row[]> {
  const { rows } = await database.db.$client.query<Row>(text);
  return rows;
}

describe('the data model doc', () => {
  it('lists the eleven identity tables', () => {
    expect(tables.map((table) => table.name).sort()).toEqual(
      [
        'accounts',
        'blocks',
        'email_changes',
        'export_requests',
        'invites',
        'jwks',
        'login_devices',
        'members',
        'passkeys',
        'sessions',
        'verifications',
      ].sort(),
    );
    for (const table of tables) {
      expect(table.columns.length, table.name).toBeGreaterThan(0);
      for (const column of table.columns) {
        expect(postgresTypes, `${table.name}.${column.name}`).toHaveProperty(column.type);
      }
    }
  });
});

describe('the migrated identity schema', () => {
  it('has exactly the tables in the doc', async () => {
    const rows = await query<{ name: string }>(
      `select table_name as name from information_schema.tables where table_schema = 'identity'`,
    );
    expect(rows.map((row) => row.name).sort()).toEqual(tables.map((table) => table.name).sort());
  });

  describe.each(tables)('identity.$name', (table) => {
    it('has the columns in the doc, with their types and nullability', async () => {
      const rows = await query<{ name: string; type: string; nullable: string }>(
        `select column_name as name, data_type as type, is_nullable as nullable
         from information_schema.columns
         where table_schema = 'identity' and table_name = '${table.name}'
         order by column_name`,
      );
      const expected = table.columns
        .map((column) => ({
          name: column.name,
          type: postgresTypes[column.type],
          nullable: column.nullable ? 'YES' : 'NO',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(rows).toEqual(expected);
    });

    it('has the foreign keys in the doc, each inside identity', async () => {
      const rows = await query<{ column: string; target: string }>(
        `select a.attname as column, ref.relname || '.' || refattr.attname as target
         from pg_constraint c
         join pg_class own on own.oid = c.conrelid
         join pg_namespace ns on ns.oid = own.relnamespace
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
         join pg_class ref on ref.oid = c.confrelid
         join pg_attribute refattr on refattr.attrelid = c.confrelid and refattr.attnum = c.confkey[1]
         where c.contype = 'f' and ns.nspname = 'identity' and own.relname = '${table.name}'
         order by a.attname`,
      );
      const expected = table.columns
        .filter((column) => column.references)
        .map((column) => ({ column: column.name, target: column.references }))
        .sort((a, b) => a.column.localeCompare(b.column));
      expect(rows).toEqual(expected);
    });

    it('has the check constraints in the doc', async () => {
      const rows = await query<{ name: string }>(
        `select c.conname as name from pg_constraint c
         join pg_class own on own.oid = c.conrelid
         join pg_namespace ns on ns.oid = own.relnamespace
         where c.contype = 'c' and ns.nspname = 'identity' and own.relname = '${table.name}'
         order by c.conname`,
      );
      expect(rows.map((row) => row.name)).toEqual(
        table.keys.filter((key) => key.endsWith('_check')).sort(),
      );
    });

    it('has the keys and indexes in the doc', async () => {
      const rows = await query<{ name: string }>(
        `select indexname as name from pg_indexes
         where schemaname = 'identity' and tablename = '${table.name}'
         order by indexname`,
      );
      expect(rows.map((row) => row.name)).toEqual(
        table.keys.filter((key) => !key.endsWith('_check')).sort(),
      );
    });
  });

  it('has identity.unaccent_lower for the display name search index', async () => {
    const rows = await query<{ result: string }>(
      `select identity.unaccent_lower('Ölena Ďárýna') as result`,
    );
    expect(rows).toEqual([{ result: 'olena daryna' }]);
  });
});

describe('IDs', () => {
  it('are version 7 UUIDs from uuidv7() when a row is inserted without one', async () => {
    const now = new Date();
    const [inserted] = await database.db
      .insert(members)
      .values({
        email: 'new@example.com',
        emailVerified: false,
        displayName: '',
        status: 'onboarding',
        updatedAt: now,
      })
      .returning({ id: members.id });
    const rows = await query<{ version: number }>(
      `select uuid_extract_version('${inserted?.id ?? ''}'::uuid) as version`,
    );
    expect(rows).toEqual([{ version: 7 }]);
  });
});
