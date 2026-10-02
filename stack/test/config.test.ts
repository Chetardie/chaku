// Guards the local stack's configuration (CHK-14; D23, ADR-0006, ADR-0013) without Docker. The
// checks against the running stack are in ../live (`pnpm stack:check`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { repoRoot, sites } from '../src/stack.ts';
import { storageConfig } from '../src/storage.ts';

const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

interface ComposeService {
  image: string;
  ports?: string[];
  healthcheck?: { test: unknown };
}

const compose = parse(read('docker-compose.yml')) as {
  services: Record<string, ComposeService>;
  volumes: Record<string, unknown>;
};
const env = parseEnv(read('.env.example'));

describe('docker-compose.yml', () => {
  const services = Object.entries(compose.services);

  it('has Postgres, Redis, SeaweedFS, Mailpit and Caddy', () => {
    expect(Object.keys(compose.services).sort()).toEqual(
      ['caddy', 'mailpit', 'postgres', 'redis', 'seaweedfs'].sort(),
    );
  });

  it.each(services)('pins %s to a tag and its digest', (_, service) => {
    expect(service.image).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
  });

  it.each(services)('gives %s a healthcheck, so `pnpm stack` can wait for it', (_, service) => {
    expect(service.healthcheck?.test).toBeDefined();
  });

  it.each(services)('publishes %s only on 127.0.0.1', (_, service) => {
    for (const port of service.ports ?? []) expect(port).toMatch(/^127\.0\.0\.1:/);
  });

  it('defaults each movable port to the value in .env.example', () => {
    const defaults = [...read('docker-compose.yml').matchAll(/\$\{(CHAKU_\w+_PORT):-(\d+)\}/g)];
    expect(defaults.length).toBeGreaterThan(0);
    for (const [, name = '', port] of defaults) expect(env[name], name).toBe(port);
  });

  it('keeps Caddy, and with it the trusted root certificate, in a named volume', () => {
    expect(Object.keys(compose.volumes)).toContain('caddy');
  });
});

describe('.env.example', () => {
  it('points every URL at this machine', () => {
    const urls = Object.entries(env).filter(([, value]) => /^\w+:\/\//.test(value ?? ''));
    expect(urls.length).toBeGreaterThan(0);
    for (const [name, value = ''] of urls) {
      expect(new URL(value).hostname, name).toMatch(/^(127\.0\.0\.1|(.+\.)?localhost)$/);
    }
  });

  it('uses the stack ports in its connection URLs', () => {
    const port = (name: string) => new URL(env[name] ?? '').port;
    expect(port('DATABASE_URL')).toBe(env['CHAKU_POSTGRES_PORT']);
    expect(port('REDIS_URL')).toBe(env['CHAKU_REDIS_PORT']);
    expect(port('SMTP_URL')).toBe(env['CHAKU_SMTP_PORT']);
    expect(port('S3_ENDPOINT')).toBe(env['CHAKU_S3_PORT']);
  });

  it('has every storage setting', () => {
    expect(() => storageConfig(env)).not.toThrow();
  });
});

describe('Caddyfile', () => {
  const caddyfile = read('stack/Caddyfile');

  it('serves exactly the stack sites', () => {
    const served = [...caddyfile.matchAll(/^(\S+\.localhost) \{$/gm)].map(([, site]) => site);
    expect(served.sort()).toEqual(Object.values(sites).sort());
  });

  it('issues every certificate from the local CA', () => {
    expect(caddyfile).toMatch(/^\s*local_certs$/m);
  });
});

describe('SeaweedFS identities', () => {
  const s3 = JSON.parse(read('stack/seaweedfs/s3.json')) as {
    identities: { name: string; actions: string[] }[];
  };

  it('lets anonymous visitors read the public bucket and nothing else', () => {
    const anonymous = s3.identities.find((identity) => identity.name === 'anonymous');
    expect(anonymous?.actions).toEqual([`Read:${env['S3_BUCKET_PUBLIC'] ?? ''}`]);
  });
});
