// Shared ESLint flat configs. Each package composes the ones it needs in its own eslint.config.js.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Colour literals and `dark:` classes (ADR-0015): components take colours from semantic tokens
// through Tailwind utilities, and tokens already change with the mode. Only the token files in
// packages/ui/src/tokens hold colour values; they opt out with `designTokens` below.
const colourLiteral =
  /(?<!&)#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
const darkVariant = /(?:^|\s)dark:/;
const colourMessage =
  'Use a semantic colour token (a Tailwind utility such as bg-primary), not a colour literal (ADR-0015).';
const darkMessage =
  'Semantic tokens already change with the mode: no `dark:` classes (ADR-0015). Add a role in @chaku/ui instead.';
const noColourLiterals = [
  { selector: `Literal[value=${String(colourLiteral)}]`, message: colourMessage },
  { selector: `TemplateElement[value.raw=${String(colourLiteral)}]`, message: colourMessage },
  { selector: `Literal[value=${String(darkVariant)}]`, message: darkMessage },
  { selector: `TemplateElement[value.raw=${String(darkVariant)}]`, message: darkMessage },
];

/** Every package: JavaScript and TypeScript rules with type information from the nearest tsconfig.json. */
export const base = defineConfig(
  globalIgnores(['**/dist/', '**/.next/', '**/.turbo/', '**/coverage/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', ...noColourLiterals],
    },
  },
  // Formatting is Prettier's job; this turns off rules that would fight it. Keep it last.
  prettier,
);

/** Code that runs in Node.js: apps/realtime, apps/worker, Game servers, scripts. */
export const node = defineConfig({
  languageOptions: { globals: globals.node },
});

/** React code: hooks and React Compiler rules, accessibility. */
export const react = defineConfig(
  reactHooks.configs.flat.recommended,
  jsxA11y.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
  },
);

/** apps/web. */
export const next = defineConfig(react, nextPlugin.configs['core-web-vitals']);

/** packages/ui's token files, the one place colour values are written (ADR-0015). */
export const designTokens = defineConfig({
  files: ['src/tokens/**'],
  rules: { 'no-restricted-syntax': 'off' },
});
