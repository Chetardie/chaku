// Shared by the `pnpm stack` commands and the stack checks.
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../..');

/** Where `pnpm stack` writes Caddy's root certificate for the one-time trust step. */
export const rootCertificateFile = path.join(repoRoot, '.data', 'caddy-root.crt');

/** The certificate's path inside the Caddy container. */
const rootCertificateInCaddy = '/data/caddy/pki/authorities/local/root.crt';

/** The volume that holds Caddy's local CA; `pnpm stack:reset` keeps it. */
export const caddyVolume = 'caddy';

/** Every HTTPS site Caddy serves (ADR-0006). */
export const sites = {
  app: 'chaku.localhost',
  realtime: 'rt.chaku.localhost',
  referenceGame: 'reference.chakugames.localhost',
  mail: 'mail.chaku.localhost',
  storage: 's3.chaku.localhost',
} as const;

/**
 * Loads `.env`, then fills anything it doesn't set from `.env.example`, so the stack works before
 * a developer has made their own `.env`. Variables already in the environment win.
 */
export function loadEnv(): void {
  for (const file of ['.env', '.env.example']) {
    const full = path.join(repoRoot, file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
}

/** Runs `docker` in the repo root and returns its output, throwing if it fails. */
export function docker(args: string[], options: SpawnSyncOptions = {}): string {
  const result = spawnSync('docker', args, { cwd: repoRoot, encoding: 'utf8', ...options });
  if (result.error) {
    throw new Error(`Could not run docker: ${result.error.message}. Is Docker installed?`);
  }
  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(`docker ${args.join(' ')} failed${stderr ? `:\n${stderr}` : ''}`);
  }
  return typeof result.stdout === 'string' ? result.stdout : '';
}

/**
 * Runs `docker compose` with `.env.example` and then `.env` as variable files, so a value in
 * `.env` (a moved port, say) wins and the defaults still apply without one.
 */
export function compose(args: string[], options: SpawnSyncOptions = {}): string {
  const envFiles = ['.env.example', '.env'].filter((file) => existsSync(path.join(repoRoot, file)));
  return docker(['compose', ...envFiles.flatMap((file) => ['--env-file', file]), ...args], options);
}

/** Reads Caddy's root certificate (PEM) from the running Caddy container. */
export function readRootCertificate(): string {
  return compose(['exec', '-T', 'caddy', 'cat', rootCertificateInCaddy]);
}

interface ComposeConfig {
  volumes?: Record<string, { name: string }>;
}

/** Docker's names for the stack's volumes, keyed by their names in docker-compose.yml. */
export function volumes(): Record<string, string> {
  const config = JSON.parse(compose(['config', '--format', 'json'])) as ComposeConfig;
  return Object.fromEntries(
    Object.entries(config.volumes ?? {}).map(([key, volume]) => [key, volume.name]),
  );
}
