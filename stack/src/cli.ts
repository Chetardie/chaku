// `pnpm stack`, `pnpm stack:down`, `pnpm stack:reset` and `pnpm db:reset` (D23).
// Guide: docs/guides/local-development.md
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { closeDatabase, createDatabase, databaseUrl } from '@chaku/db';

import { resetLocalDatabase } from './database.ts';
import {
  caddyVolume,
  compose,
  docker,
  loadEnv,
  readRootCertificate,
  repoRoot,
  rootCertificateFile,
  sites,
  volumes,
} from './stack.ts';
import { applyBuckets, storageConfig } from './storage.ts';

const commands: Record<string, () => Promise<void> | void> = {
  up,
  down,
  reset,
  'db:reset': dbReset,
};

async function up(): Promise<void> {
  console.log('Starting the local stack and waiting until every service is healthy…');
  compose(['up', '--detach', '--wait', '--wait-timeout', '180'], { stdio: 'inherit' });

  const config = storageConfig();
  await applyBuckets(config);
  console.log(`Buckets ${config.privateBucket} and ${config.publicBucket} ready.`);

  const certificateChanged = exportRootCertificate();

  console.log(`
The stack is up:
  Mail (Mailpit)     https://${sites.mail}
  Storage (S3)       https://${sites.storage}
  App                https://${sites.app}   (pnpm dev)
  Realtime           https://${sites.realtime}
  Reference Game     https://${sites.referenceGame}
`);
  if (certificateChanged) {
    console.log(
      `Caddy has a new root certificate: ${path.relative(repoRoot, rootCertificateFile)}\n` +
        'Trust it once, as described in docs/guides/local-development.md#trust-the-local-certificate.',
    );
  }
}

function down(): void {
  compose(['down'], { stdio: 'inherit' });
}

/** Stops the stack and deletes its data, but keeps Caddy's CA so the browser trust stays valid. */
function reset(): void {
  const wiped = Object.entries(volumes())
    .filter(([key]) => key !== caddyVolume)
    .map(([, name]) => name);
  compose(['down', '--remove-orphans'], { stdio: 'inherit' });
  const existing = new Set(docker(['volume', 'ls', '--quiet']).split(/\r?\n/));
  for (const name of wiped) {
    if (existing.has(name)) docker(['volume', 'rm', name]);
  }
  console.log(`Wiped ${wiped.join(', ')}. Run pnpm stack to start again.`);
}

/** Drops every module schema in DATABASE_URL, migrates from scratch and loads the fixed seed. */
async function dbReset(): Promise<void> {
  const url = new URL(databaseUrl());
  const db = createDatabase(url.toString());
  try {
    await resetLocalDatabase(db);
  } finally {
    await closeDatabase(db);
  }
  console.log(`Database ${url.pathname.slice(1)} on ${url.host} is reset and seeded.`);
}

/** Copies Caddy's root certificate to `.data/` and says whether it differs from the last copy. */
function exportRootCertificate(): boolean {
  const certificate = readRootCertificate();
  const previous = existsSync(rootCertificateFile) ? readFileSync(rootCertificateFile, 'utf8') : '';
  mkdirSync(path.dirname(rootCertificateFile), { recursive: true });
  writeFileSync(rootCertificateFile, certificate);
  return certificate !== previous;
}

const command = process.argv[2] ?? '';
const run = commands[command];
if (run === undefined) {
  console.error(`Usage: node stack/src/cli.ts <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
loadEnv();
try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
