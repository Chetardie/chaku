// After `next build`: copies the static files next to the standalone server, which Next.js leaves
// to the deploy step, so `pnpm start` runs exactly what production runs (ADR-0011).
import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const standalone = path.join(app, '.next/standalone');
const server = path.join(standalone, 'apps/web');

cpSync(path.join(app, '.next/static'), path.join(server, '.next/static'), { recursive: true });
if (existsSync(path.join(app, 'public'))) {
  cpSync(path.join(app, 'public'), path.join(server, 'public'), { recursive: true });
}

/**
 * On Windows, Next.js copies pnpm's links as file symlinks that point at folders, which Windows
 * refuses to follow (EPERM). Recreate them as junctions, as pnpm makes them. Linux, where
 * production runs, is unaffected.
 */
function relinkAsJunctions(folder: string): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) {
      const target = path.resolve(folder, readlinkSync(full));
      if (existsSync(target) && lstatSync(target).isDirectory()) {
        rmSync(full);
        symlinkSync(target, full, 'junction');
      }
    } else if (entry.isDirectory()) {
      relinkAsJunctions(full);
    }
  }
}

if (process.platform === 'win32') relinkAsJunctions(path.join(standalone, 'node_modules'));
