// CHK-19: a strict Content Security Policy with a fresh nonce on every request (D9, D35), with
// every origin taken from the environment (ADR-0010).
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from '../proxy.ts';
import { contentSecurityPolicy, type CspEnv } from '../src/server/csp.ts';

const env: CspEnv = {
  NODE_ENV: 'production',
  APP_URL: 'https://chaku.example',
  REALTIME_URL: 'wss://rt.chaku.example',
  GAMES_DOMAIN: 'games.example',
  S3_PUBLIC_ENDPOINT: 'https://files.example',
};

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(';').map((directive) => {
      const [name = '', ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe('contentSecurityPolicy', () => {
  const policy = directives(contentSecurityPolicy('abc123', env));

  it('runs only scripts carrying the nonce, and what they load', () => {
    expect(policy.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
    expect(policy.get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('allows styles only with the nonce', () => {
    expect(policy.get('style-src')).toEqual(["'self'", "'nonce-abc123'"]);
  });

  it('cannot be framed by anyone', () => {
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('connects to the app, the realtime gateway and storage from the environment', () => {
    expect(policy.get('connect-src')).toEqual([
      "'self'",
      'wss://rt.chaku.example',
      'https://files.example',
    ]);
  });

  it('frames only Games on the games domain (ADR-0002)', () => {
    expect(policy.get('frame-src')).toEqual(['https://*.games.example']);
  });

  it('shows images from the app and storage (D42)', () => {
    expect(policy.get('img-src')).toEqual(["'self'", 'blob:', 'data:', 'https://files.example']);
  });

  it('blocks plugins, base tag changes and forms to other sites', () => {
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.has('upgrade-insecure-requests')).toBe(true);
  });

  it('adds what development needs only in development', () => {
    const development = directives(
      contentSecurityPolicy('abc123', { ...env, NODE_ENV: 'development' }),
    );
    expect(development.get('script-src')).toContain("'unsafe-eval'");
    expect(development.get('style-src')).toContain("'unsafe-inline'");
  });
});

describe('proxy', () => {
  const nonceOf = (policy: string | null) => /'nonce-([^']+)'/.exec(policy ?? '')?.[1];

  it('sends a different nonce with every request', () => {
    const first = proxy(new NextRequest('https://chaku.localhost/'));
    const second = proxy(new NextRequest('https://chaku.localhost/'));
    const firstNonce = nonceOf(first.headers.get('Content-Security-Policy'));
    const secondNonce = nonceOf(second.headers.get('Content-Security-Policy'));
    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(secondNonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(firstNonce).not.toBe(secondNonce);
  });

  it('hands the same policy to the render, so Next.js puts the nonce on its scripts', () => {
    const response = proxy(new NextRequest('https://chaku.localhost/'));
    const policy = response.headers.get('Content-Security-Policy');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(policy));
  });
});
