// Where the Postgres MCP may connect (CHK-24, D9): the local stack's database, as the read-only
// agent role, and nowhere else. stack/src/mcp-postgres.ts refuses to start on anything this rejects.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { agentPassword, agentRole } from './agent-role.ts';
import { repoRoot } from './stack.ts';

/** Hosts that are this machine. The stack's ports listen on 127.0.0.1 only. */
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export class NotLocalDatabaseError extends Error {
  override name = 'NotLocalDatabaseError';
}

/** Reads a setting the way `pnpm stack` does: the environment, then `.env`, then `.env.example`. */
export type Settings = (name: string) => string | undefined;

/** The settings of this checkout, without loading the rest of `.env` into the environment. */
export function localSettings(root = repoRoot): Settings {
  const files = ['.env', '.env.example']
    .map((file) => path.join(root, file))
    .filter((file) => existsSync(file))
    .map((file) => parseEnv(readFileSync(file, 'utf8')));
  return (name) => process.env[name] ?? files.find((file) => file[name] !== undefined)?.[name];
}

/**
 * The URL the MCP connects to. By default the stack's `chaku` database on 127.0.0.1, at the port
 * `CHAKU_POSTGRES_PORT` moves it to. `CHAKU_MCP_DATABASE_URL` picks another local database, such as
 * a test one. Throws `NotLocalDatabaseError` for anything that isn't the agent role on this machine.
 */
export function agentDatabaseUrl(settings: Settings): string {
  const override = settings('CHAKU_MCP_DATABASE_URL');
  if (override) return checkAgentDatabaseUrl(override);
  const url = new URL('postgres://127.0.0.1/chaku');
  url.port = settings('CHAKU_POSTGRES_PORT') ?? '5432';
  url.username = agentRole;
  url.password = agentPassword;
  url.searchParams.set('sslmode', 'disable');
  return checkAgentDatabaseUrl(url.toString());
}

/** Returns `value` if it is a Postgres URL for the agent role on this machine, or throws. */
export function checkAgentDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NotLocalDatabaseError('The MCP database URL is not a URL.');
  }
  // Never echo the URL itself: it carries a password.
  const refuse = (reason: string) => {
    throw new NotLocalDatabaseError(
      `The Postgres MCP connects only to the local stack: ${reason}.`,
    );
  };
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    refuse(`${url.protocol} is not Postgres`);
  }
  if (!loopbackHosts.has(url.hostname)) {
    refuse(`host ${url.hostname || '(none)'} is not this machine`);
  }
  if (decodeURIComponent(url.username) !== agentRole) refuse(`it must sign in as ${agentRole}`);
  if (url.pathname.length <= 1) refuse('the URL names no database');
  // libpq and node-postgres read some parameters (host, user, options) from the query string, which
  // could point the connection somewhere else; only sslmode may be set.
  for (const key of url.searchParams.keys()) {
    if (key !== 'sslmode') refuse(`the parameter ${key} is not allowed`);
  }
  return url.toString();
}
