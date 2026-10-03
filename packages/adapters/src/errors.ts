// Error reporting (D19). Sentry arrives in phase 4 (D55); until then errors are logged. Whatever
// the reporter, its context is scrubbed first: no request bodies, cookies, credentials or query
// strings, which may hold Message text or tokens (D9).

export interface ErrorRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ErrorContext {
  /** Where it happened: an oRPC procedure path, a route, a job name. */
  tags?: Record<string, string>;
  request?: ErrorRequest;
}

export interface ErrorReporter {
  capture(error: unknown, context?: ErrorContext): void;
}

const credentialHeaders = new Set(['cookie', 'set-cookie', 'authorization', 'proxy-authorization']);

/** The URL without its query string or fragment. */
function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/s, '');
}

export function scrubErrorContext(context: ErrorContext = {}): ErrorContext {
  const scrubbed: ErrorContext = {};
  if (context.tags) scrubbed.tags = { ...context.tags };
  if (context.request) {
    const { method, url, headers } = context.request;
    const request: ErrorRequest = {};
    if (method !== undefined) request.method = method;
    if (url !== undefined) request.url = scrubUrl(url);
    if (headers) {
      request.headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => !credentialHeaders.has(name.toLowerCase())),
      );
    }
    scrubbed.request = request;
  }
  return scrubbed;
}

/** The part of a logger this needs: pino on the server, the console in the browser. */
export interface ErrorLog {
  error(details: object, message: string): void;
}

export function createLogErrorReporter(log: ErrorLog): ErrorReporter {
  return {
    capture(error, context) {
      log.error({ err: error, ...scrubErrorContext(context) }, 'error');
    },
  };
}
