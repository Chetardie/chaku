// Runs before every page request: a fresh CSP nonce (D35). Next.js reads the nonce from the request's
// Content-Security-Policy header and puts it on its own scripts and styles.
import { NextResponse, type NextRequest } from 'next/server';

import { serverEnv } from './src/env.ts';
import { contentSecurityPolicy, createNonce } from './src/server/csp.ts';

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce, serverEnv());

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not oRPC, static files or images. Prefetches skip it, as Next.js recommends.
      source: '/((?!rpc(?:/|$)|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
