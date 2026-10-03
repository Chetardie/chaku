// The read-only Postgres role for agents (CHK-24, D9). The Postgres MCP (stack/src/mcp-postgres.ts)
// connects as this role and nothing else. `pnpm stack` and `pnpm db:reset` create it; a migration
// never does, so it can't exist anywhere but a local or CI database.
import type { Database } from '@chaku/db';

/** The role's name. Roles belong to the whole server, so `pnpm db:reset` keeps it. */
export const agentRole = 'chaku_readonly';

/**
 * A fixed local-only password, like the stack's own `chaku:chaku` (ADR-0013): the role exists only
 * in the local stack, whose port listens on 127.0.0.1, and in CI.
 */
export const agentPassword = 'chaku_readonly';

/** One simple query, so Postgres runs it as one transaction. */
const roleSql = `
  do $$
  begin
    create role ${agentRole} login password '${agentPassword}';
  exception when duplicate_object or unique_violation then
    null;
  end
  $$;
  alter role ${agentRole} with login nosuperuser nocreatedb nocreaterole inherit password '${agentPassword}';
  alter role ${agentRole} set statement_timeout = '30s';
  grant pg_read_all_data to ${agentRole};
`;

/**
 * Creates the role if it's missing and sets what it may do: read every table and view, in every
 * schema and database (`pg_read_all_data`), and nothing else. With no `create` on any schema,
 * writes and DDL fail with a permission error. A long query is cancelled after 30 seconds.
 * Running it again changes nothing.
 */
export async function ensureAgentRole(db: Database): Promise<void> {
  // Roles belong to the whole server, so runs against different databases at once (parallel test
  // files) can still update the same catalog row. Postgres then fails one of them; it runs again.
  for (let attempt = 1; ; attempt++) {
    try {
      await db.$client.query(roleSql);
      return;
    } catch (error) {
      if (attempt >= 5 || !isConcurrentUpdate(error)) throw error;
    }
  }
}

function isConcurrentUpdate(error: unknown): boolean {
  const { code, message } = error as { code?: string; message?: string };
  return code === 'XX000' && message === 'tuple concurrently updated';
}
