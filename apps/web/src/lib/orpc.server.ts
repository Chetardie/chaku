// The server-side router client (D50): Server Components call procedures in-process, through the
// same middleware as /rpc. instrumentation.ts registers it once when the server starts, so client
// components that import `orpc` never pull this file (or next/headers) into their bundles. It is
// shared across requests, so its context holds only the current request's headers.
import { createRouterClient } from '@orpc/server';
import { headers } from 'next/headers';

import { router } from '../server/rpc/router.ts';

export function registerServerClient(): void {
  globalThis.$client ??= createRouterClient(router, {
    context: async () => ({ headers: await headers() }),
  });
}
