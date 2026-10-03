// The worker ships as one file (ADR-0011, D45): the workspace packages are TypeScript source and
// the npm packages are bundled in too, so its image needs Node.js and dist/ only.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  platform: 'node',
  format: 'esm',
  outDir: 'dist',
  sourcemap: true,
  dts: false,
  // graphile-config can load TypeScript config files; the worker passes its options in code.
  deps: { alwaysBundle: [/^(?!typescript$)/], neverBundle: ['typescript'] },
});
