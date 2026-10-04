// CHK-19: one key scheme (D50, web data flow doc). The in-process client the server renders with and
// the RPCLink client in the browser give the same query keys, so hydrated data is found.
import { createRouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { client, createBrowserClient, orpc } from '../src/lib/orpc.ts';
import { router } from '../src/server/rpc/router.ts';

const server = createTanstackQueryUtils(
  createRouterClient(router, { context: { headers: new Headers() } }),
);
const browser = createTanstackQueryUtils(createBrowserClient('https://chaku.localhost'));

describe('query keys', () => {
  it('are the same on the server and in the browser', () => {
    const serverKey = server.health.check.queryOptions().queryKey;
    expect(browser.health.check.queryOptions().queryKey).toEqual(serverKey);
    expect(orpc.health.check.queryOptions().queryKey).toEqual(serverKey);
  });

  it('come from the procedure path, so a prefix invalidates a namespace', () => {
    expect(orpc.health.key()).toEqual([['health'], {}]);
    expect(orpc.health.check.key({ type: 'query' })).toEqual([
      ['health', 'check'],
      { type: 'query' },
    ]);
  });
});

describe('client on the server', () => {
  afterEach(() => {
    globalThis.$client = undefined;
  });

  it('calls the router client that instrumentation.ts registered', async () => {
    const check = vi.fn(() => Promise.resolve({ status: 'ok' as const }));
    // Only the procedure this test calls.
    globalThis.$client = { health: { check } } as unknown as typeof globalThis.$client;
    await expect(client.health.check()).resolves.toEqual({ status: 'ok' });
    expect(check).toHaveBeenCalledOnce();
  });

  it('says so when nothing is registered, instead of calling over HTTP', () => {
    expect(() => client.health.check()).toThrow(/not registered/);
  });
});
