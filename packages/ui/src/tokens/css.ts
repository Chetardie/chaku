// Turns the token files into `tokens.css` (ADR-0015): Tailwind's defaults replaced by our scales,
// each mode's colour roles as CSS variables, and the `@theme inline` mapping that makes them
// utilities. scripts/tokens.ts writes the file; test/tokens-css.test.ts fails when it is stale.
import { fontWeight, radiusSteps, spacing, typeScale, zIndex } from './scales.ts';
import { colorRoles, shapeRoles, type Mode, type Theme } from './semantic.ts';

const header = `/* Generated from packages/ui/src/tokens by \`pnpm --filter @chaku/ui tokens\` (ADR-0015).
   Do not edit: change the token files and run the script again. */`;

function block(selector: string, lines: string[], indent = ''): string {
  const body = lines.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

function modeLines(theme: Theme, mode: Mode): string[] {
  return [
    `color-scheme: ${mode};`,
    ...colorRoles.map((role) => `--${role}: ${theme.modes[mode][role]};`),
  ];
}

/**
 * Each mode's colour roles as CSS variables. Light is the default; dark follows the system unless
 * `data-theme="light"` is set on `<html>`, and `data-theme` on any element forces a mode inside it.
 */
export function renderModeVariables(theme: Theme): string {
  return [
    block(':root,\n[data-theme="light"]', modeLines(theme, 'light')),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', modeLines(theme, 'dark'), '  ')}\n}`,
    block('[data-theme="dark"]', modeLines(theme, 'dark')),
  ].join('\n\n');
}

/** Tailwind's theme: our scales and shape roles in place of its defaults. */
function renderTheme(theme: Theme): string {
  return block('@theme', [
    // No default palette, fonts, sizes, weights or radii: `bg-orange-500` doesn't exist.
    '--color-*: initial;',
    '--font-*: initial;',
    '--text-*: initial;',
    '--font-weight-*: initial;',
    '--radius-*: initial;',
    `--spacing: ${spacing};`,
    ...Object.entries(typeScale).flatMap(([step, { size, lineHeight }]) => [
      `--text-${step}: ${size};`,
      `--text-${step}--line-height: ${lineHeight};`,
    ]),
    ...Object.entries(fontWeight).map(([name, value]) => `--font-weight-${name}: ${value};`),
    ...Object.entries(zIndex).map(([name, value]) => `--z-index-${name}: ${value};`),
    ...Object.entries(radiusSteps).map(([step, value]) => `--radius-${step}: ${value};`),
    // Shape roles don't change with the mode, so they are theme variables themselves:
    // `rounded-bubble`, `rounded-card`, `font-sans`.
    ...shapeRoles.map((role) => `--${role}: ${theme.shape[role]};`),
  ]);
}

/** `bg-bubble-own`, `text-muted-foreground`: each colour role as a utility that follows the mode. */
function renderColorMapping(): string {
  return block(
    '@theme inline',
    colorRoles.map((role) => `--color-${role}: var(--${role});`),
  );
}

export function renderTokensCss(theme: Theme): string {
  return `${[header, renderTheme(theme), renderModeVariables(theme), renderColorMapping()].join('\n\n')}\n`;
}
