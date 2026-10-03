// CHK-19: a standalone build with the React Compiler on (spec §5.5, ADR-0011).
import { describe, expect, it } from 'vitest';

import config from '../next.config.ts';
import { securityHeaders } from '../src/server/security-headers.ts';

describe('next.config.ts', () => {
  it('builds standalone output with the React Compiler on', () => {
    expect(config.output).toBe('standalone');
    expect(config.reactCompiler).toBe(true);
  });

  it('traces files from the repo root, where the workspace packages are', async () => {
    const { repoRoot } = await import('./setup.ts');
    expect(config.outputFileTracingRoot).toBe(repoRoot);
  });

  it('sends the security headers on every path', async () => {
    expect(await config.headers?.()).toEqual([{ source: '/:path*', headers: securityHeaders }]);
  });

  it('points next-intl at the request configuration', () => {
    expect(config.turbopack?.resolveAlias?.['next-intl/config']).toBe('./src/i18n/request.ts');
  });
});
