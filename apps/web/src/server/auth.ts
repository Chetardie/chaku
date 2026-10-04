// The web app's Better Auth instance (ADR-0004), made once per server process by the identity module
// from the validated environment, the database and the adapters. /api/auth serves it; oRPC and
// Server Components read sessions through src/server/session.ts.
import { type Auth, createAuth } from '@chaku/identity';

import { serverEnv } from '../env.ts';
import { localeCookie, resolveLocale } from '../i18n/locale.ts';
import { adapters } from './adapters.ts';
import { database } from './db.ts';

/** The language of a request from its cookie and Accept-Language, as pages choose it (D18). */
export function requestLocale(headers: Headers | undefined) {
  const cookie = headers
    ?.get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === localeCookie)?.[1];
  return resolveLocale({ cookie, acceptLanguage: headers?.get('accept-language') });
}

function createWebAuth(): Auth {
  const env = serverEnv();
  const { email, rateLimiter, botCheck, log } = adapters();
  return createAuth(
    { db: database(), email, rateLimiter, botCheck, log, requestLocale },
    {
      appUrl: env.APP_URL,
      secret: env.BETTER_AUTH_SECRET,
      passkeyRpId: env.PASSKEY_RP_ID,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
          : undefined,
    },
  );
}

// Kept on globalThis so development reloads reuse it. Tests put their own instance here.
const store = globalThis as { chakuAuth?: Auth };

export function auth(): Auth {
  store.chakuAuth ??= createWebAuth();
  return store.chakuAuth;
}
