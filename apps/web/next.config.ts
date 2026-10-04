import { existsSync } from 'node:fs';
import path from 'node:path';

import type { NextConfig } from 'next';

import { securityHeaders } from './src/server/security-headers.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// On a developer's machine and in CI, the environment comes from the repo's `.env`, then
// `.env.example` fills the rest, as for `pnpm stack` (D23). Neither overrides a variable that is
// already set. The standalone server never reads this file: deployed, the platform sets everything.
for (const file of ['.env', '.env.example']) {
  const full = path.join(repoRoot, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const config: NextConfig = {
  output: 'standalone',
  // Standalone output copies the workspace packages it uses, which live above this app.
  outputFileTracingRoot: repoRoot,
  reactCompiler: true,
  poweredByHeader: false,
  // The repo's CLAUDE.md already points agents at Next.js's bundled docs; don't write more files.
  agentRules: false,
  // Workspace packages are TypeScript source (ADR-0011).
  transpilePackages: ['@chaku/adapters', '@chaku/db', '@chaku/identity'],
  // pino loads parts of itself at runtime; bundling breaks that.
  serverExternalPackages: ['pino', 'pino-pretty'],
  turbopack: {
    resolveAlias: {
      // What `next-intl/plugin` sets up when its message extractor is off. The plugin itself loads
      // @swc/core and @parcel/watcher for that extractor, native addons we don't need.
      'next-intl/config': './src/i18n/request.ts',
    },
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default config;
