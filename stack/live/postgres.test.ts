// CHK-14: `psql` shows `pg_trgm` and `unaccent` available (spec D33: people search and Post search).
// Migrations create them (CHK-17), as they will on Railway, so here they are only available.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compose, loadEnv } from '../src/stack.ts';

loadEnv();

/** Created and dropped by this check, so it never touches the extensions migrations made in `chaku`. */
const scratchDatabase = 'chaku_stack_check';

function psql(sql: string, database = 'chaku'): string {
  return compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '--username=chaku',
    `--dbname=${database}`,
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--set=ON_ERROR_STOP=1',
    '--command',
    sql,
  ]).trim();
}

function dropScratchDatabase(): void {
  psql(`drop database if exists ${scratchDatabase} with (force)`);
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

  describe('in a fresh database', () => {
    // A database of its own, because `chaku` already has both extensions once `pnpm db:reset` ran.
    beforeAll(() => {
      dropScratchDatabase();
      psql(`create database ${scratchDatabase}`);
    });
    afterAll(dropScratchDatabase);

    it('can create and use both extensions', () => {
      const result = psql(
        `
          create extension pg_trgm;
          create extension unaccent;
          select similarity('chaku', 'chaky') > 0.3, unaccent('Café');
        `,
        scratchDatabase,
      );
      expect(result).toContain('t|Cafe');
    });
  });
});
