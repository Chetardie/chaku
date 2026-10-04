// Shared Stylelint config for CSS in apps and packages (ADR-0015). Colours come from tokens
// (`var(--primary)`, or a Tailwind utility), never as literals: no hex, named colours, `rgb()`,
// `hsl()` or `oklch()`. The values live in packages/ui/src/tokens, which generates tokens.css; that
// file is ignored here.
import strictValue from 'stylelint-declaration-strict-value';

const message =
  'Use a colour token (`var(--role)` or a Tailwind utility), not a literal (ADR-0015)';

/** @type {import('stylelint').Config} */
export default {
  plugins: [strictValue],
  ignoreFiles: ['**/tokens.css', '**/node_modules/**', '**/.next/**', '**/storybook-static/**'],
  rules: {
    // Colour properties take a variable or a keyword, nothing else.
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'fill', 'stroke'],
      {
        // `rgb(…)` and friends are literals too; `var()` stays allowed.
        ignoreFunctions: false,
        ignoreValues: [
          'currentcolor',
          'currentColor',
          'transparent',
          'inherit',
          'initial',
          'unset',
          'revert',
          'revert-layer',
          'none',
        ],
        message,
      },
    ],
    // Literals inside shorthands and other values: `border: 1px solid #000`, `box-shadow`, gradients.
    'color-no-hex': [true, { message }],
    'color-named': ['never', { message }],
    'function-disallowed-list': [
      ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
      { message },
    ],
  },
};
