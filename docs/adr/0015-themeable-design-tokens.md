---
status: accepted
date: 2026-10-03
---

# Every colour, font and shape comes from themeable tokens in `packages/ui`

The look of Chaku lives in one place, so changing the brand or adding a theme later means editing token files, not components.

**Three layers**, all in `packages/ui/src/tokens/`:
1. **Primitives:** the raw scales, named by what they are: `cream-50…950`, `coral-50…950`, `sun-…`, `ink-…`, the Participant hues, font families, the radius steps. Only theme files read them.
2. **Semantic tokens:** names by role, which components use. shadcn/ui's names are kept so its components work unchanged (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`). Chaku adds its own roles:
   - `chat-background`, `bubble-own`, `bubble-own-foreground`, `bubble-other`, `bubble-other-foreground`
   - `challenge`, `challenge-foreground` (sun, for Game Challenges only)
   - `presence-online`, `unread`, `mention`
   - `participant-1` to `participant-8` (Group Chat names)
   - `success`, `warning`, `danger`, `info`
   - `radius-bubble`, `radius-bubble-tail`, `radius-card`, `font-sans`, `font-mono`
3. **Tailwind mapping:** `@theme inline { --color-bubble-own: var(--bubble-own); … }` turns every semantic token into utilities (`bg-bubble-own`, `text-muted-foreground`).

**A theme is one file** that sets every semantic token for a brand in each mode: `themes/warm.ts` exports `light` and `dark`. A new brand is a new file; a new mode (for example high contrast) is a new key. A type check makes every theme define every semantic token.

**The source is TypeScript, the output is CSS.** A small script in `packages/ui` turns the token files into `tokens.css`, which is committed so Tailwind and Storybook read it with no build step. A test fails if `tokens.css` is out of date. TypeScript is the source because the same values are needed in places CSS variables can't reach:
- emails (`react-email` inlines resolved light values)
- the PWA manifest and `<meta name="theme-color">`
- the `theme` that Games get in `init` (§5.4): a small set of resolved semantic values, so a Game can match without reading our CSS
- the Figma library (semantic tokens as variables with light and dark modes)
- the contrast test below

**Choosing a theme.** `tokens.css` puts the light values on `:root`, the dark values under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`, and again under `[data-theme="dark"]`. The Member's choice (light, dark or system) is stored per device in a cookie. The server sets `data-theme` on `<html>`, or nothing for system, so the first paint is right without a script. The setting lives in Settings → Language and theme.

**Rules, checked in CI:**
- **No colours outside the token files.** `tokens.css` starts with `@theme { --color-*: initial; }`, so Tailwind's default palette (`bg-orange-500`) doesn't exist. A Stylelint rule (`declaration-strict-value` for colour properties) and an ESLint `no-restricted-syntax` rule reject hex, `rgb()` and `oklch()` literals in app and component code.
- **No `dark:` in components.** Semantic tokens already change with the mode, so components never branch on it. A `dark:` class is rejected by lint outside `packages/ui/src/tokens/`. This rule is what lets a third theme be added without touching components.
- **Contrast is tested for every theme.** A Vitest test in `packages/ui` lists the foreground and background pairs (for example `bubble-own-foreground` on `bubble-own`, `muted-foreground` on `chat-background`) and checks each against WCAG 2.2 AA in every mode of every theme (4.5:1 for text, 3:1 for large text and UI parts, D18).

## Why

The Warm direction (CHK-10) is the first brand, not the last word. The screen map already proposes colour tweaks after one look at real screens, and themes tend to change after a beta. If components use coral directly, each change is a search through the whole app, and dark mode becomes a second set of classes on every element. Role names make the change local: `bubble-own` can move from coral to something else in one line, and every screen follows.

Games, emails and the PWA manifest can't read CSS variables, so a CSS-only source would mean copying values by hand into three places.

Removing Tailwind's palette and rejecting colour literals turns "use the tokens" from a convention into a build error, which matters with coding agents writing most of the UI.

## Considered options

- **Tokens as plain CSS only (shadcn's default):** simplest, but emails, Games, the manifest and Figma would each need hand-copied values, and the contrast test would have to parse CSS.
- **Style Dictionary:** does the same multi-target output, but a full build tool for about 60 tokens and a handful of outputs is more than a 100-line script.
- **Tailwind's default palette plus conventions:** nothing stops `bg-orange-600` from appearing in a component, and a rebrand means finding every one.
- **`dark:` variants in components:** the usual Tailwind approach, but it doubles the colour classes, and each new theme would need another variant on every element.
- **Theme stored on the Member:** it would follow them across devices, but phones and laptops often want different modes, and the server would need a database read before the first paint.

## Consequences

- The tokens ticket in the Design System project builds the three layers, the script, the lint rules and the contrast test before the first component. The values in [foundations](../design-system/foundations.md) are the seeds of the Warm theme.
- Storybook gets a toolbar switch for theme and mode, and every component story is checked in both modes.
- The `game-sdk` doc defines which semantic values go into `init.theme`.
- New tokens are added as semantic roles first. A component that needs a colour no role describes gets a new role, not a primitive.
- The Figma library is generated from the same token files (CHK-34).
