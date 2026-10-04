# ui

Design tokens and, from CHK-41, components: shadcn/ui on Base UI, Tailwind 4, Storybook ([foundations](../../docs/design-system/foundations.md), ADR-0015).

## Tokens

`src/tokens/` is the one place colours, fonts and shapes are written:

| File | Holds |
|---|---|
| `primitives.ts` | Raw values named by what they are: the 50–950 colour scales (`cream`, `ink`, `coral`, `sun`, and the hue families behind the Participant and status colours), font stacks, radius steps. Only theme files read them. |
| `semantic.ts` | The role names components use (shadcn's, then Chaku's) and the `Theme` type, which makes a theme set every role in every mode. |
| `themes/warm.ts` | The Warm theme: every colour role in `light` and `dark`, and the shape roles. |
| `scales.ts` | Spacing (4px base), the type scale, font weights and z-index layers, shared by every theme. |
| `contrast.ts` | WCAG contrast and the foreground/background pairs every theme must pass. |
| `css.ts` | Turns the tokens into `tokens.css`. |

`tokens.css` is generated and committed: `pnpm --filter @chaku/ui tokens` writes it, and a test fails while it is stale. It replaces Tailwind's default palette, fonts, sizes, weights and radii, so only the tokens exist as utilities: `bg-bubble-own`, `text-muted-foreground`, `rounded-bubble`, `font-sans`, `p-4`, `text-base`, `z-dialog`.

The web app imports it in `apps/web/app/globals.css`; other code that needs the values (emails, the PWA manifest, Games) imports `@chaku/ui/tokens`.

**Rules:** no colour literals and no `dark:` classes outside `src/tokens/` (ESLint and Stylelint reject them). A colour no role describes gets a new role in `semantic.ts`, set in every theme. A new pair of roles used together goes into `contrastPairs`.

## Storybook

`pnpm --filter @chaku/ui storybook` runs it at <http://localhost:6006>. The toolbar switches theme and mode. Foundations → Tokens shows every role in light and dark. `pnpm --filter @chaku/ui test:storybook` renders every story in Chromium with the accessibility checks, once per mode, as CI does.
