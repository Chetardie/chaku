// CHK-36, ADR-0015: tokens.css is generated from the TypeScript token files and committed, so
// Tailwind and Storybook read it with no build step. This fails when the committed file is stale.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { colorRoles, defaultTheme, renderTokensCss, shapeRoles } from '../src/tokens/index.ts';

const committed = readFileSync(path.resolve(import.meta.dirname, '../tokens.css'), 'utf8');
const generated = renderTokensCss(defaultTheme);

/** The declarations of the first block that starts with `selector {`. */
function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

const light = ':root,\n[data-theme="light"]';

describe('tokens.css', () => {
  it('is up to date with the token files (run `pnpm --filter @chaku/ui tokens`)', () => {
    // Git may check the file out with CRLF line endings on Windows.
    expect(committed.replace(/\r\n/g, '\n')).toBe(generated);
  });

  it('removes the default palette, fonts, sizes, weights and radii of Tailwind', () => {
    const theme = blockAfter(generated, '@theme');
    for (const namespace of ['color', 'font', 'text', 'font-weight', 'radius']) {
      expect(theme).toContain(`--${namespace}-*: initial;`);
    }
  });

  it('puts the light values on :root and the dark values under the system setting and data-theme', () => {
    const lightBlock = blockAfter(generated, light);
    expect(lightBlock).toContain(`--background: ${defaultTheme.modes.light.background};`);
    expect(lightBlock).toContain('color-scheme: light;');

    const system = generated.slice(generated.indexOf('@media (prefers-color-scheme: dark)'));
    const systemDark = blockAfter(system, ':root:not([data-theme="light"])');
    const forcedDark = blockAfter(generated, '[data-theme="dark"]');
    for (const dark of [systemDark, forcedDark]) {
      expect(dark).toContain(`--background: ${defaultTheme.modes.dark.background};`);
      expect(dark).toContain('color-scheme: dark;');
    }
  });

  it('sets every colour role in each mode and maps it to a Tailwind colour', () => {
    const mapping = blockAfter(generated, '@theme inline');
    for (const role of colorRoles) {
      expect(blockAfter(generated, light)).toContain(`--${role}: `);
      expect(blockAfter(generated, '[data-theme="dark"]')).toContain(`--${role}: `);
      expect(mapping).toContain(`--color-${role}: var(--${role});`);
    }
  });

  it('sets the shape roles, spacing, type scale, weights and z-index layers as Tailwind theme variables', () => {
    const theme = blockAfter(generated, '@theme');
    for (const role of shapeRoles) expect(theme).toContain(`--${role}: `);
    expect(theme).toContain('--spacing: 0.25rem;');
    expect(theme).toContain('--text-base: 1rem;');
    expect(theme).toContain('--text-base--line-height: 1.5rem;');
    expect(theme).toContain('--font-weight-semibold: 600;');
    expect(theme).toContain('--z-index-dialog: 50;');
  });
});
