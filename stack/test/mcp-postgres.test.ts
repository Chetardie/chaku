// CHK-24: the Postgres MCP, started the way Claude Code starts it from .mcp.json, lists the identity
// tables and returns seed rows, and every write fails with Postgres's permission error (D9). It runs
// against this test worker's database instead of the stack's `chaku`, through the same guard.
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { useTestDatabase } from '@chaku/db/testing';
import { seedIdentity } from '@chaku/identity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { agentPassword, agentRole, ensureAgentRole } from '../src/agent-role.ts';
import { repoRoot } from '../src/stack.ts';

const database = useTestDatabase();

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

/** A minimal MCP client over stdio: newline-delimited JSON-RPC, one request at a time. */
class McpClient {
  private nextId = 1;
  private readonly waiting = new Map<
    number,
    (message: { result?: unknown; error?: unknown }) => void
  >();

  private readonly server: ChildProcessWithoutNullStreams;

  constructor(server: ChildProcessWithoutNullStreams) {
    this.server = server;
    createInterface({ input: server.stdout }).on('line', (line) => {
      const message = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
      if (message.id !== undefined) this.waiting.get(message.id)?.(message);
    });
  }

  async request<T>(method: string, params: object = {}): Promise<T> {
    const id = this.nextId++;
    const reply = new Promise<{ result?: unknown; error?: unknown }>((resolve) => {
      this.waiting.set(id, resolve);
    });
    this.server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    const message = await reply;
    if (message.error) throw new Error(`${method}: ${JSON.stringify(message.error)}`);
    return message.result as T;
  }

  notify(method: string): void {
    this.server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }

  async callTool(name: string, args: object): Promise<{ isError: boolean; text: string }> {
    const result = await this.request<ToolResult>('tools/call', { name, arguments: args });
    return {
      isError: result.isError ?? false,
      text: result.content.map((part) => part.text).join('\n'),
    };
  }
}

let server: ChildProcessWithoutNullStreams | undefined;
let client: McpClient;
let stderr = '';

beforeAll(async () => {
  await ensureAgentRole(database.db);

  const url = new URL(database.db.$client.options.connectionString ?? '');
  url.username = agentRole;
  url.password = agentPassword;
  server = spawn(process.execPath, [path.join(repoRoot, 'stack/src/mcp-postgres.ts')], {
    env: { ...process.env, CHAKU_MCP_DATABASE_URL: url.toString() },
  });
  server.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  client = new McpClient(server);
  await client.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'chaku-test', version: '0' },
  });
  client.notify('notifications/initialized');
});

afterAll(() => {
  server?.kill();
});

// One server for every test. `useTestDatabase` empties the tables before each, so a test seeds what
// it reads.
describe('the Postgres MCP', () => {
  it('offers DBHub tools to run SQL and search the schema', async () => {
    const { tools } = await client.request<{ tools: { name: string }[] }>('tools/list');
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['execute_sql', 'search_objects']),
    );
  });

  it('lists the identity tables', async () => {
    const result = await client.callTool('search_objects', {
      object_type: 'table',
      schema: 'identity',
    });
    expect(result.isError, stderr).toBe(false);
    for (const table of ['members', 'sessions', 'invites', 'blocks']) {
      expect(result.text).toContain(`"${table}"`);
    }
  });

  it('returns seed rows', async () => {
    await seedIdentity(database.db);
    const result = await client.callTool('execute_sql', {
      sql: 'select username from identity.members order by username',
    });
    expect(result.isError, stderr).toBe(false);
    for (const username of ['admin', 'alice', 'bohdan', 'chen', 'daryna']) {
      expect(result.text).toContain(`"${username}"`);
    }
  });

  it.each([
    [
      'insert',
      `insert into identity.export_requests (member_id, requested_at)
                select id, now() from identity.members limit 1`,
    ],
    ['update', `update identity.members set display_name = 'Changed'`],
    ['create table', 'create table scratch_notes (id int)'],
  ])('fails on %s with a permission error from Postgres', async (_, sql) => {
    const result = await client.callTool('execute_sql', { sql });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/permission denied/);
  });
});
