import { adapters } from '../../../src/server/adapters.ts';
import { createRpcHandler, handleRpc } from '../../../src/server/rpc/handler.ts';
import { router } from '../../../src/server/rpc/router.ts';

// Created on the first request, not at import: `next build` imports this file without a runtime
// environment.
let handler: ReturnType<typeof createRpcHandler> | undefined;

function handle(request: Request): Promise<Response> {
  handler ??= createRpcHandler(router, adapters());
  return handleRpc(handler, request);
}

export { handle as GET, handle as POST };
