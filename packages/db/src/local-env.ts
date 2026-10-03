// The local environment for scripts and tests. Apps never import this: deployed, the platform sets
// their environment.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './modules.ts';

/**
 * Loads `.env`, then fills anything it doesn't set from `.env.example`, like `pnpm stack` does.
 * Only scripts and tests on a developer's machine or in CI call this.
 */
export function loadLocalEnv(): void {
  for (const file of ['.env', '.env.example']) {
    const full = path.join(repoRoot, file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
}
