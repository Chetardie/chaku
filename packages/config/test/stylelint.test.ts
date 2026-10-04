// CHK-36, ADR-0015: CSS takes colours from tokens, never as literals.
/* eslint-disable no-restricted-syntax -- the fixtures are the literals the rule rejects */
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import config from '../stylelint.js';

async function warnings(code: string): Promise<string[]> {
  const result = await stylelint.lint({ code, config });
  return result.results.flatMap((file) => file.warnings.map((warning) => warning.rule));
}

describe('Stylelint colour rule', () => {
  it.each([
    'a { color: #c8461b; }',
    'a { background-color: #fff; }',
    'a { background: #FFF7EF; }',
    'a { border: 1px solid #2b1d14; }',
    'a { color: rgb(200 70 27); }',
    'a { color: rgba(0, 0, 0, 0.5); }',
    'a { color: hsl(15 76% 45%); }',
    'a { color: oklch(0.57 0.17 37); }',
    'a { fill: red; }',
    'a { outline-color: white; }',
    'a { box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); }',
    'a { background: linear-gradient(#fff, var(--card)); }',
    'a { border-top: 1px solid red; }',
  ])('rejects a colour literal: %s', async (code) => {
    expect((await warnings(code)).length).toBeGreaterThan(0);
  });

  it.each([
    'a { color: var(--primary); }',
    'a { background-color: var(--color-background); }',
    'a { border: 1px solid var(--border); }',
    'a { color: currentColor; }',
    'a { background: transparent; }',
    'a { border: none; }',
    'a { box-shadow: 0 1px 2px var(--shadow); }',
    'a { color: inherit; }',
    'a { margin: 4px; }',
  ])('accepts a token or keyword: %s', async (code) => {
    expect(await warnings(code)).toEqual([]);
  });
});
