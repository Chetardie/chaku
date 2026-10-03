// The Postgres MCP for agents (CHK-24, D9), started by Claude Code from .mcp.json over stdio. It
// runs DBHub (@bytebase/dbhub) against the local stack's database as the read-only agent role, and
// refuses to start for any other host or role (agent-database.ts). Writes fail in Postgres itself:
// the role can only read (agent-role.ts). Guide: docs/guides/local-development.md#postgres-mcp
import { agentDatabaseUrl, localSettings, NotLocalDatabaseError } from './agent-database.ts';

let dsn: string;
try {
  dsn = agentDatabaseUrl(localSettings());
} catch (error) {
  // stdout is the MCP channel, so problems go to stderr.
  console.error(error instanceof NotLocalDatabaseError ? error.message : error);
  process.exit(1);
}

// DBHub reads its settings from the command line first. With --dsn set, a DSN in the environment or
// a .env file is never read, and a dbhub.toml in the working directory is an error, not a quiet
// switch to other databases. This folder has none.
process.argv = [
  process.argv[0] ?? 'node',
  process.argv[1] ?? '',
  '--transport=stdio',
  `--dsn=${dsn}`,
];
process.chdir(import.meta.dirname);

// DBHub's entry point starts the server when it loads. Its type declarations are an empty file
// that isn't a module, so the import goes through a plain string.
const dbhub: string = '@bytebase/dbhub';
await import(dbhub);
