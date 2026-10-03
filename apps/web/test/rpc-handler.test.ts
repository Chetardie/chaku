// CHK-19: the /rpc handler. CSRF protection, an error log with the procedure and code but never the
// input (D9), and a generic answer for a bug.
import type { ErrorContext } from '@chaku/adapters/errors';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { base } from '../src/server/rpc/context.ts';
import { createRpcHandler, handleRpc } from '../src/server/rpc/handler.ts';

const secret = 'message-text-4b8d';

const router = {
  chat: {
    send: base.input(z.object({ body: z.string() })).handler(({ input }) => {
      throw new Error(`database rejected ${input.body}`);
    }),
    limited: base.input(z.object({ body: z.string() })).handler(({ errors }) => {
      throw errors.RATE_LIMITED({ data: { retryAfter: 30 } });
    }),
    ping: base.handler(() => 'pong'),
  },
};

function setup() {
  const lines: { level: string; details: object; message: string }[] = [];
  const reports: { error: unknown; context: ErrorContext | undefined }[] = [];
  const handler = createRpcHandler(router, {
    log: {
      info: (details: object, message: string) => lines.push({ level: 'info', details, message }),
      error: (details: object, message: string) => lines.push({ level: 'error', details, message }),
    } as never,
    errors: { capture: (error, context) => reports.push({ error, context }) },
  });
  const call = (path: string, input: unknown, headers: Record<string, string> = {}) =>
    handleRpc(
      handler,
      new Request(`https://chaku.localhost/rpc/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': 'orpc', ...headers },
        body: JSON.stringify({ json: input }),
      }),
    );
  return { lines, reports, call };
}

describe('/rpc handler', () => {
  it('answers a call from our client', async () => {
    const { call } = setup();
    const response = await call('chat/ping', undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ json: 'pong' });
  });

  it('rejects a cross-site POST, which cannot set the CSRF header', async () => {
    const { call } = setup();
    const response = await call('chat/ping', undefined, { 'x-csrf-token': '' });
    expect(response.status).toBe(403);
  });

  it('logs the procedure path and error code, never the input (D9)', async () => {
    const { call, lines, reports } = setup();
    await call('chat/send', { body: secret });
    expect(lines).toEqual([
      {
        level: 'error',
        details: { procedure: 'chat.send', code: 'INTERNAL_SERVER_ERROR' },
        message: 'procedure failed',
      },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.context).toEqual({ tags: { procedure: 'chat.send' } });
    expect(JSON.stringify(lines)).not.toContain(secret);
  });

  it('logs a refusal (4xx) without reporting it as a bug', async () => {
    const { call, lines, reports } = setup();
    const response = await call('chat/limited', { body: secret });
    expect(response.status).toBe(429);
    expect(lines).toEqual([
      {
        level: 'info',
        details: { procedure: 'chat.limited', code: 'RATE_LIMITED' },
        message: 'procedure refused',
      },
    ]);
    expect(reports).toEqual([]);
  });

  it('answers a bug with a generic 500 that reveals nothing', async () => {
    const { call } = setup();
    const response = await call('chat/send', { body: secret });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(secret);
    expect(text).not.toContain('database rejected');
    expect(JSON.parse(text)).toMatchObject({
      json: {
        defined: false,
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'Internal server error',
      },
    });
  });

  it('answers 404 outside the router', async () => {
    const { call } = setup();
    expect((await call('nothing/here', undefined)).status).toBe(404);
  });
});
