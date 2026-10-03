// The Content Security Policy (D9, D35). A fresh nonce on every request: only scripts and styles
// carrying it run, and 'strict-dynamic' lets them load the rest. Nonces make every page render per
// request, which D35 accepts. Origins come from the environment, so previews work too (ADR-0010).
import type { ServerEnv } from '../env.ts';

export type CspEnv = Pick<
  ServerEnv,
  'NODE_ENV' | 'APP_URL' | 'REALTIME_URL' | 'GAMES_DOMAIN' | 'S3_PUBLIC_ENDPOINT'
>;

/** 16 random bytes, base64: unguessable and different for every request. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function contentSecurityPolicy(nonce: string, env: CspEnv): string {
  const development = env.NODE_ENV === 'development';
  const storage = new URL(env.S3_PUBLIC_ENDPOINT).origin;
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React in development rebuilds error stacks with eval; never in a production build.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    // Development injects styles without a nonce.
    'style-src': ["'self'", development ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    // Images: our own (/media redirects to storage, D42), uploads before they are sent.
    'img-src': ["'self'", 'blob:', 'data:', storage],
    'font-src': ["'self'"],
    // The realtime gateway (ADR-0009) and pre-signed uploads straight to storage (D42).
    'connect-src': ["'self'", new URL(env.REALTIME_URL).origin, storage],
    // Games run on their own origins in frames (ADR-0002).
    'frame-src': [`https://*.${env.GAMES_DOMAIN}`],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const policy = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.join(' ')}`,
  );
  if (new URL(env.APP_URL).protocol === 'https:') policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}
