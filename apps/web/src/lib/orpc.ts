// One client shape on both sides (D50, web data flow doc): the in-process router client while
// rendering on the server, an RPCLink client over /rpc in the browser. Query keys come only from
// `orpc`, so they are the same in both places.
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { SimpleCsrfProtectionLinkPlugin } from '@orpc/client/plugins';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';

import type { Router } from '../server/rpc/router.ts';

declare global {
  /** The server-side router client, registered by instrumentation.ts when the server starts. */
  var $client: RouterClient<Router> | undefined;
}

/** The browser's client: same-origin calls to /rpc, with the header the CSRF check wants. */
export function createBrowserClient(origin: string): RouterClient<Router> {
  return createORPCClient(
    new RPCLink({ url: `${origin}/rpc`, plugins: [new SimpleCsrfProtectionLinkPlugin()] }),
  );
}

/**
 * The server-side client, looked up when a procedure is called rather than at import: `next build`
 * imports pages without starting the server, so nothing is registered yet. Building query keys
 * walks the paths without calling anything.
 */
function lazyServerClient(path: readonly string[] = []): unknown {
  return new Proxy(() => undefined, {
    get(_, key) {
      // Not a thenable, so awaiting it by mistake doesn't hang.
      if (typeof key !== 'string' || key === 'then') return undefined;
      return lazyServerClient([...path, key]);
    },
    apply(_, __, args: unknown[]) {
      if (!globalThis.$client) {
        throw new Error('The server-side oRPC client is not registered (instrumentation.ts).');
      }
      const procedure = path.reduce<unknown>(
        (node, key) => (node as Record<string, unknown>)[key],
        globalThis.$client,
      ) as (...input: unknown[]) => unknown;
      return procedure(...args);
    },
  });
}

export const client: RouterClient<Router> =
  typeof window === 'undefined'
    ? (lazyServerClient() as RouterClient<Router>)
    : createBrowserClient(window.location.origin);

export const orpc = createTanstackQueryUtils(client);
