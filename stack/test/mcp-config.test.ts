// CHK-24: the Postgres MCP can reach only the local stack's database, as the read-only agent role
// (D9, ADR-0013). Nothing in .mcp.json points anywhere, and the server refuses to start for a host
// that isn't this machine.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  agentDatabaseUrl,
  checkAgentDatabaseUrl,
  localSettings,
  NotLocalDatabaseError,
  type Settings,
} from '../src/agent-database.ts';
import { agentRole } from '../src/agent-role.ts';
import { repoRoot } from '../src/stack.ts';

const mcpJson = readFileSync(path.join(repoRoot, '.mcp.json'), 'utf8');

interface McpServer {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

const servers = (JSON.parse(mcpJson) as { mcpServers: Record<string, McpServer> }).mcpServers;

const settings =
  (values: Record<string, string>): Settings =>
  (name) =>
    values[name];

describe('.mcp.json', () => {
  it('has only the Postgres MCP; Linear, Context7 and Figma are account-level connectors', () => {
    expect(Object.keys(servers)).toEqual(['postgres']);
  });

  it('starts it over stdio through the guard script in this checkout', () => {
    expect(servers['postgres']).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['${CLAUDE_PROJECT_DIR:-.}/stack/src/mcp-postgres.ts'],
    });
  });

  it('holds no URL, host, port or password', () => {
    expect(mcpJson).not.toMatch(/:\/\/|@|localhost|127\.0\.0\.1|\d{4,5}|password|DSN/i);
  });
});

describe('the MCP database URL', () => {
  it("defaults to the stack's chaku database on 127.0.0.1, as the read-only role", () => {
    const url = new URL(agentDatabaseUrl(settings({})));
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.port).toBe('5432');
    expect(url.pathname).toBe('/chaku');
    expect(url.username).toBe(agentRole);
  });

  it('follows CHAKU_POSTGRES_PORT when the stack port is moved', () => {
    const url = new URL(agentDatabaseUrl(settings({ CHAKU_POSTGRES_PORT: '55432' })));
    expect(url.port).toBe('55432');
  });

  it.each([
    'postgres://chaku_readonly:pw@127.0.0.1:5432/chaku_test_1',
    'postgresql://chaku_readonly:pw@localhost/chaku',
    'postgres://chaku_readonly:pw@[::1]:5432/chaku?sslmode=disable',
  ])('accepts another local database: %s', (url) => {
    expect(checkAgentDatabaseUrl(url)).toBe(new URL(url).toString());
  });

  it.each([
    ['a remote host', 'postgres://chaku_readonly:pw@db.example.com:5432/chaku'],
    ['a private network address', 'postgres://chaku_readonly:pw@10.0.0.5/chaku'],
    ['Docker host networking', 'postgres://chaku_readonly:pw@host.docker.internal/chaku'],
    ['a list of hosts', 'postgres://chaku_readonly:pw@127.0.0.1,db.example.com/chaku'],
    [
      'a host in the query string',
      'postgres://chaku_readonly:pw@127.0.0.1/chaku?host=db.example.com',
    ],
    ['a user in the query string', 'postgres://chaku_readonly:pw@127.0.0.1/chaku?user=chaku'],
    ['the superuser', 'postgres://chaku:chaku@127.0.0.1:5432/chaku'],
    ['no database', 'postgres://chaku_readonly:pw@127.0.0.1:5432'],
    ['another protocol', 'mysql://chaku_readonly:pw@127.0.0.1/chaku'],
    ['no URL at all', 'chaku'],
  ])('refuses %s', (_, url) => {
    expect(() => checkAgentDatabaseUrl(url)).toThrow(NotLocalDatabaseError);
  });

  it('refuses a non-local override without echoing its password', () => {
    const run = () =>
      agentDatabaseUrl(
        settings({ CHAKU_MCP_DATABASE_URL: 'postgres://chaku_readonly:s3cret@db.example.com/x' }),
      );
    expect(run).toThrow(/host db\.example\.com is not this machine/);
    expect(run).not.toThrow(/s3cret/);
  });

  it('reads the environment, then .env, then .env.example', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'chaku-settings-'));
    // Names of their own: the test setup has loaded this checkout's .env into the environment.
    writeFileSync(path.join(root, '.env'), 'CHAKU_PROBE_PORT=6000\nCHAKU_PROBE_ENV=file\n');
    writeFileSync(
      path.join(root, '.env.example'),
      'CHAKU_PROBE_PORT=5432\nCHAKU_PROBE_OTHER=example\n',
    );
    process.env['CHAKU_PROBE_ENV'] = 'environment';
    try {
      const read = localSettings(root);
      expect(read('CHAKU_PROBE_PORT')).toBe('6000');
      expect(read('CHAKU_PROBE_OTHER')).toBe('example');
      expect(read('CHAKU_PROBE_ENV')).toBe('environment');
      expect(read('CHAKU_PROBE_MISSING')).toBeUndefined();
    } finally {
      delete process.env['CHAKU_PROBE_ENV'];
    }
  });
});

describe('stack/src/mcp-postgres.ts', () => {
  it('exits before connecting when the URL points away from this machine', () => {
    const result = spawnSync(process.execPath, [path.join(repoRoot, 'stack/src/mcp-postgres.ts')], {
      env: {
        ...process.env,
        CHAKU_MCP_DATABASE_URL: 'postgres://chaku_readonly:pw@db.example.com:5432/chaku',
      },
      encoding: 'utf8',
      input: '',
      timeout: 20_000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('connects only to the local stack');
  });
});
