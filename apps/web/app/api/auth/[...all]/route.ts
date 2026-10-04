// Better Auth's endpoints (ADR-0004): email codes and links, Google, passkeys, sign-out. The
// identity module decides which of its endpoints exist.
import { auth } from '../../../../src/server/auth.ts';

// The instance is made on the first request, not at import: `next build` imports this file
// without a runtime environment.
function handle(request: Request): Promise<Response> {
  return auth().handler(request);
}

export { handle as GET, handle as POST };
