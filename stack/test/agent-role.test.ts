// CHK-24: the agents' role reads everything and writes nothing (D9). `pnpm stack` and `pnpm db:reset`
// create it; a write, an update or a new table fails with a permission error.
import { closeDatabase, createDatabase, type Database } from '@chaku/db';
import { useTestDatabase } from '@chaku/db/testing';
import { seedIdentity } from '@chaku/identity';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { agentPassword, agentRole, ensureAgentRole } from '../src/agent-role.ts';
import { resetLocalDatabase } from '../src/database.ts';

const database = useTestDatabase();

/** This worker's database, signed in as the agent role. */
let asAgent: Database | undefined;
const agent = () => {
  if (!asAgent) throw new Error('Not connected yet.');
  return asAgent;
};

beforeAll(async () => {
  await ensureAgentRole(database.db);
  const url = new URL(database.db.$client.options.connectionString ?? '');
  url.username = agentRole;
  url.password = agentPassword;
  asAgent = createDatabase(url.toString());
});

afterAll(async () => {
  if (asAgent) await closeDatabase(asAgent);
});

beforeEach(async () => {
  await seedIdentity(database.db);
});

/** The SQLSTATE a statement fails with as the agent, or `ok`. */
async function outcome(statement: string): Promise<string> {
  try {
    await agent().$client.query(statement);
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

describe('the agent role', () => {
  it('can be made again and again', async () => {
    await ensureAgentRole(database.db);
    await Promise.all([ensureAgentRole(database.db), ensureAgentRole(database.db)]);
    const { rows } = await database.db.$client.query<{
      login: boolean;
      superuser: boolean;
      readsAll: boolean;
    }>(
      `select rolcanlogin as login, rolsuper as superuser,
              pg_has_role($1, 'pg_read_all_data', 'usage') as "readsAll"
       from pg_roles where rolname = $1`,
      [agentRole],
    );
    expect(rows).toEqual([{ login: true, superuser: false, readsAll: true }]);
  });

  it('is set up again by pnpm db:reset', async () => {
    // Dropping the role would break the other test files using it, so change it instead.
    await database.db.$client.query(`alter role ${agentRole} set statement_timeout = '1s'`);
    await resetLocalDatabase(database.db);
    const { rows } = await database.db.$client.query<{ settings: string[] }>(
      `select setconfig as settings from pg_db_role_setting
       where setrole = $1::regrole and setdatabase = 0`,
      [agentRole],
    );
    expect(rows).toEqual([{ settings: ['statement_timeout=30s'] }]);
  });

  it('reads the seed in every module schema', async () => {
    const { rows } = await agent().$client.query<{ username: string }>(
      'select username from identity.members order by username',
    );
    expect(rows.map((row) => row.username)).toEqual(['admin', 'alice', 'bohdan', 'chen', 'daryna']);
  });

  it.each([
    [
      'insert',
      `insert into identity.blocks (blocker_id, blocked_id, created_at)
                select a.id, b.id, now() from identity.members a, identity.members b
                where a.username = 'alice' and b.username = 'chen'`,
    ],
    ['update', `update identity.members set display_name = 'Changed' where username = 'alice'`],
    ['delete', `delete from identity.sessions`],
    ['create table', 'create table scratch_notes (id int)'],
    ['create table in a module schema', 'create table identity.scratch_notes (id int)'],
    ['create schema', 'create schema scratch'],
    ['truncate', 'truncate identity.sessions'],
    ['adding a job', `select graphile_worker.add_job('identity.delete_expired_sessions')`],
  ])('fails with a permission error on %s', async (_, statement) => {
    expect(await outcome(statement)).toBe('42501');
  });

  it('leaves the data as it was', async () => {
    await outcome(`update identity.members set display_name = 'Changed' where username = 'alice'`);
    const { rows } = await database.db.$client.query<{ name: string }>(
      `select display_name as name from identity.members where username = 'alice'`,
    );
    expect(rows).toEqual([{ name: 'Alice' }]);
  });
});
