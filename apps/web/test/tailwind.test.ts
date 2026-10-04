// CHK-36, ADR-0015: the web app's Tailwind has Chaku's tokens and nothing else. The stylesheet is
// compiled the way `next build` compiles it (app/globals.css through @tailwindcss/postcss), with the
// class names under test added as if a component used them.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const globals = path.resolve(import.meta.dirname, '../app/globals.css');

/** The rule Tailwind generates for each class, or undefined when the class makes no CSS. */
async function compile(classes: string[]): Promise<Map<string, string | undefined>> {
  const source = `${readFileSync(globals, 'utf8')}\n@source inline("${classes.join(' ')}");\n`;
  const { css } = await postcss([tailwindcss()]).process(source, { from: globals });
  return new Map(
    classes.map((name) => [
      name,
      new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(css)?.[1]?.replace(/\s+/g, ' ').trim(),
    ]),
  );
}

describe('Tailwind in the web app', () => {
  it("generates no CSS for Tailwind's default palette, fonts or weights", async () => {
    const defaults = [
      'bg-orange-500',
      'text-red-600',
      'border-gray-200',
      'bg-white',
      'text-black',
      'font-serif',
      'font-bold',
      'text-4xl',
      'rounded-3xl',
    ];
    const rules = await compile(defaults);
    for (const name of defaults) expect(rules.get(name), name).toBeUndefined();
  });

  it('turns every kind of token into utilities', async () => {
    const rules = await compile([
      'bg-background',
      'text-muted-foreground',
      'bg-bubble-own',
      'text-participant-3',
      'border-input',
      'font-sans',
      'font-mono',
      'font-semibold',
      'rounded-bubble',
      'rounded-card',
      'rounded-pill',
    ]);
    expect(rules.get('bg-background')).toBe('background-color: var(--background);');
    expect(rules.get('text-muted-foreground')).toBe('color: var(--muted-foreground);');
    expect(rules.get('bg-bubble-own')).toBe('background-color: var(--bubble-own);');
    expect(rules.get('text-participant-3')).toBe('color: var(--participant-3);');
    expect(rules.get('border-input')).toBe('border-color: var(--input);');
    expect(rules.get('font-sans')).toBe('font-family: var(--font-sans);');
    expect(rules.get('font-mono')).toBe('font-family: var(--font-mono);');
    expect(rules.get('font-semibold')).toContain('font-weight: var(--font-weight-semibold);');
    expect(rules.get('rounded-bubble')).toBe('border-radius: var(--radius-bubble);');
    expect(rules.get('rounded-card')).toBe('border-radius: var(--radius-card);');
    expect(rules.get('rounded-pill')).toBe('border-radius: var(--radius-pill);');
  });

  it('has the spacing, type scale and z-index layers as utilities', async () => {
    const rules = await compile([
      'p-4',
      'gap-6',
      'text-sm',
      'text-base',
      'text-3xl',
      'z-dialog',
      'z-toast',
    ]);
    expect(rules.get('p-4')).toBe('padding: calc(var(--spacing) * 4);');
    expect(rules.get('gap-6')).toBe('gap: calc(var(--spacing) * 6);');
    expect(rules.get('text-base')).toBe(
      'font-size: var(--text-base); line-height: var(--tw-leading, var(--text-base--line-height));',
    );
    expect(rules.get('text-sm')).toContain('font-size: var(--text-sm);');
    expect(rules.get('text-3xl')).toContain('font-size: var(--text-3xl);');
    expect(rules.get('z-dialog')).toBe('z-index: var(--z-index-dialog);');
    expect(rules.get('z-toast')).toBe('z-index: var(--z-index-toast);');
  });
});
