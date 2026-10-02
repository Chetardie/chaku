// CHK-14: `psql` shows `pg_trgm` and `unaccent` available (spec D33: people search and Post search).
// Migrations create them (CHK-17), as they will on Railway, so here they are only available.
import { describe, expect, it } from 'vitest';

import { compose, loadEnv } from '../src/stack.ts';

loadEnv();

function psql(sql: string): string {
  return compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '--username=chaku',
    '--dbname=chaku',
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--set=ON_ERROR_STOP=1',
    '--command',
    sql,
  ]).trim();
}

describe('Postgres', () => {
  it('runs version 18', () => {
    expect(psql('show server_version')).toMatch(/^18\./);
  });

  it('has pg_trgm and unaccent available', () => {
    const available = psql(
      "select name from pg_available_extensions where name in ('pg_trgm', 'unaccent') order by name",
    );
    expect(available.split(/\r?\n/)).toEqual(['pg_trgm', 'unaccent']);
  });

  it('can create and use both extensions', () => {
    const result = psql(`
      begin;
      create extension pg_trgm;
      create extension unaccent;
      select similarity('chaku', 'chaky') > 0.3, unaccent('Café');
      rollback;
    `);
    expect(result).toContain('t|Cafe');
  });
});
