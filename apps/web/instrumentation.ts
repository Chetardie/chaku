import type { Instrumentation } from 'next';

/** Runs once when the server starts. */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { checkEnvironment } = await import('./src/server/startup.ts');
  checkEnvironment();
  const { registerServerClient } = await import('./src/lib/orpc.server.ts');
  registerServerClient();
}

/** Errors thrown while rendering or in route handlers, reported without request bodies (D9). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { adapters } = await import('./src/server/adapters.ts');
  adapters().errors.capture(error, {
    tags: { route: context.routePath, routeType: context.routeType },
    request: { method: request.method, url: request.path, headers: request.headers },
  });
};
