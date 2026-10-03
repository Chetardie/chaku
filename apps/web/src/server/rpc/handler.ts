// The /rpc endpoint for calls from the browser (D50). Server Components skip it and call the same
// router in-process (src/lib/orpc.server.ts).
import { ORPCError, onError, type Router } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { SimpleCsrfProtectionHandlerPlugin } from '@orpc/server/plugins';

import type { ErrorReporter } from '@chaku/adapters/errors';
import type { Logger } from '@chaku/adapters/log';

import type { BaseContext } from './context.ts';

export const rpcPrefix = '/rpc';

export interface RpcHandlerDependencies {
  log: Pick<Logger, 'info' | 'error'>;
  errors: ErrorReporter;
}

export function createRpcHandler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any procedure contract
  router: Router<any, BaseContext>,
  { log, errors }: RpcHandlerDependencies,
): RPCHandler<BaseContext> {
  return new RPCHandler(router, {
    plugins: [
      // Every call must carry a header a cross-site form or link can't set (the RPCLink sends it).
      new SimpleCsrfProtectionHandlerPlugin(),
    ],
    clientInterceptors: [
      // The procedure path and the error code, never the input: it can hold Message text (D9).
      onError((error, { path }) => {
        const procedure = path.join('.');
        // A 4xx is the caller's problem (validation, a limit, not found); a 5xx is a bug.
        if (error instanceof ORPCError && error.status < 500) {
          log.info({ procedure, code: error.code }, 'procedure refused');
        } else {
          const code = error instanceof ORPCError ? String(error.code) : 'INTERNAL_SERVER_ERROR';
          log.error({ procedure, code }, 'procedure failed');
          errors.capture(error, { tags: { procedure } });
        }
      }),
    ],
  });
}

/** Answers one request; anything outside the router is a 404. */
export async function handleRpc(handler: RPCHandler<BaseContext>, request: Request) {
  const { response } = await handler.handle(request, {
    prefix: rpcPrefix,
    context: { headers: request.headers },
  });
  return response ?? new Response('Not found', { status: 404 });
}
