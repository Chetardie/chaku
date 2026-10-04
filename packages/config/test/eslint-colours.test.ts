// CHK-36, ADR-0015: no colour literals or `dark:` classes in app and component code; only the token
// files in packages/ui/src/tokens write colour values.
/* eslint-disable no-restricted-syntax -- the fixtures are the literals the rule rejects */
import path from 'node:path';

import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { base, designTokens } from '../eslint.js';

const ui = path.resolve(import.meta.dirname, '../../ui');
const rule = base.find((config) => config.rules?.['no-restricted-syntax'])?.rules?.[
  'no-restricted-syntax'
];

/** Lints a file in packages/ui with the shared colour rule, as packages/ui's config composes it. */
function lint(code: string, file: string): string[] {
  const linter = new Linter({ cwd: ui });
  const config = [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      rules: { 'no-restricted-syntax': rule },
    },
    ...designTokens,
  ] as Linter.Config[];
  return linter
    .verify(code, config, { filename: path.join(ui, file) })
    .map((message) => message.message);
}

const component = 'src/components/badge.tsx';
const token = 'src/tokens/themes/sunset.ts';

describe('ESLint colour rule', () => {
  it('is part of the base config every package uses', () => {
    expect(rule).toBeDefined();
  });

  it.each([
    ['a hex colour', `export const c = '#C8461B';`],
    ['a short hex colour', `export const c = '#fff';`],
    ['a hex colour in a class', `export const B = () => <b className="bg-[#c8461b]" />;`],
    ['rgb()', `export const c = 'rgb(200 70 27)';`],
    ['rgba()', `export const c = 'rgba(0, 0, 0, 0.5)';`],
    ['hsl()', `export const c = 'hsl(15 76% 45%)';`],
    ['oklch()', `export const c = 'oklch(0.57 0.17 37)';`],
    ['oklch() in a template', 'export const c = (a: number) => `oklch(0.57 0.17 ${String(a)})`;'],
    ['a dark: class', `export const B = () => <b className="bg-card dark:bg-background" />;`],
    ['a dark: class first', `export const c = 'dark:text-foreground';`],
    ['a dark: class in a template', 'export const c = (x: string) => `p-2 dark:${x}`;'],
  ])('rejects %s in a component', (_, code) => {
    expect(lint(code, component)).toHaveLength(1);
  });

  it.each([
    [
      'a token utility',
      `export const B = () => <b className="bg-bubble-own text-muted-foreground" />;`,
    ],
    ['an anchor link', `export const B = () => <a href="#messages">Skip</a>;`],
    ['a numeric entity-like id', `export const id = 'chat-#12-thread';`],
    ['a word ending in lab', `export const c = 'Collab(1)';`],
    ['a word containing dark', `export const c = 'darkness: none';`],
  ])('accepts %s', (_, code) => {
    expect(lint(code, component)).toEqual([]);
  });

  it.each([
    ['a hex colour', `export const c = '#C8461B';`],
    ['oklch()', `export const c = 'oklch(0.57 0.17 37)';`],
    ['a dark: class', `export const c = 'dark:bg-background';`],
  ])('accepts %s inside packages/ui/src/tokens', (_, code) => {
    expect(lint(code, token)).toEqual([]);
  });
});
