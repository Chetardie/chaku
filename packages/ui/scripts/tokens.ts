// Writes tokens.css from the token files (ADR-0015). Run it after changing anything in src/tokens:
// pnpm --filter @chaku/ui tokens
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { defaultTheme, renderTokensCss } from '../src/tokens/index.ts';

const file = path.resolve(import.meta.dirname, '../tokens.css');
writeFileSync(file, renderTokensCss(defaultTheme));
console.log(`Wrote ${path.relative(process.cwd(), file)}`);
