// The local environment, as next.config.ts loads it: `.env`, then `.env.example` fills the rest.
import { existsSync } from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

for (const file of ['.env', '.env.example']) {
  const full = path.join(repoRoot, file);
  if (existsSync(full)) process.loadEnvFile(full);
}
