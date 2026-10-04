// CHK-20: what is configured from env (ADR-0010), and the Better Auth endpoints that stay off.
import { useTestDatabase } from '@chaku/db/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { seedIdentity } from '../src/seed.ts';
import { Browser, createTestAuth } from './helpers/auth.ts';

const database = useTestDatabase();

beforeEach(async () => {
  await seedIdentity(database.db);
});

describe('Google login', () => {
  it('is off without keys', async () => {
    const testAuth = createTestAuth(database.db);
    expect(testAuth.auth.options.socialProviders).toBeUndefined();
    const response = await new Browser(testAuth).request('/sign-in/social', {
      provider: 'google',
      callbackURL: '/',
    });
    expect(response.status).toBe(404);
  });

  it('is on with both keys, and trusted for account linking (D37)', async () => {
    const testAuth = createTestAuth(database.db, {
      config: { google: { clientId: 'test-client-id', clientSecret: 'test-client-secret' } },
    });
    expect(testAuth.auth.options.socialProviders?.google.clientId).toBe('test-client-id');
    expect(testAuth.auth.options.account.accountLinking).toMatchObject({
      enabled: true,
      trustedProviders: ['google'],
    });

    const response = await new Browser(testAuth).request('/sign-in/social', {
      provider: 'google',
      callbackURL: '/',
    });
    expect(response.status).toBe(200);
    expect(String(response.body?.['url'])).toMatch(/^https:\/\/accounts\.google\.com\//);
  });
});

describe('passkeys', () => {
  it('use the relying party ID and origin from config', async () => {
    const testAuth = createTestAuth(database.db, {
      config: { appUrl: 'https://app.chaku.example', passkeyRpId: 'chaku.example' },
    });
    const browser = new Browser(testAuth);
    // Registration options need a logged-in, fresh session.
    await browser.logIn('alice@example.com');
    const response = await browser.request('/passkey/generate-register-options', undefined, {
      origin: 'https://app.chaku.example',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ rp: { id: 'chaku.example', name: 'Chaku' } });
  });
});

describe('endpoints that stay off', () => {
  it.each([
    ['/sign-up/email', { email: 'x@example.com', password: 'password123', name: 'X' }],
    ['/sign-in/email', { email: 'alice@example.com', password: 'password123' }],
    ['/update-user', { name: 'Mallory' }],
    ['/list-sessions', undefined],
    ['/revoke-other-sessions', {}],
    ['/email-otp/verify-email', { email: 'alice@example.com', otp: '123456' }],
  ])('%s answers 404', async (path, body) => {
    const response = await new Browser(createTestAuth(database.db)).request(path, body);
    expect(response.status).toBe(404);
  });
});
