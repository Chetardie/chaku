// Shared ESLint flat configs. Each package composes the ones it needs in its own eslint.config.js.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
