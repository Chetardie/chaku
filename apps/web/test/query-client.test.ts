// CHK-19: a new QueryClient for every server request, one per tab in the browser (web data flow
// doc), and server data keeps its types through dehydration.
import { dehydrate, environmentManager, hydrate } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { getQueryClient, makeQueryClient } from '../src/lib/query-client.ts';

afterEach(() => {
  environmentManager.setIsServer(() => typeof window === 'undefined');
});

describe('getQueryClient', () => {
  it('gives every server render its own client', async () => {
    environmentManager.setIsServer(() => true);
    const [first, second] = await Promise.all([
      Promise.resolve().then(getQueryClient),
      Promise.resolve().then(getQueryClient),
    ]);
    expect(first).not.toBe(second);
    first.setQueryData(['member'], 'Alice');
    expect(second.getQueryData(['member'])).toBeUndefined();
  });

  it('reuses one client in the browser', () => {
    environmentManager.setIsServer(() => false);
    expect(getQueryClient()).toBe(getQueryClient());
  });
});

describe('dehydrate and hydrate', () => {
  it('keeps Dates as Dates', async () => {
    const server = makeQueryClient();
    const sentAt = new Date('2026-10-03T12:00:00Z');
    await server.query({ queryKey: ['message'], queryFn: () => ({ sentAt }) });
    const state = JSON.parse(JSON.stringify(dehydrate(server))) as ReturnType<typeof dehydrate>;

    const browser = makeQueryClient();
    hydrate(browser, state);
    expect(browser.getQueryData(['message'])).toEqual({ sentAt });
  });
});
