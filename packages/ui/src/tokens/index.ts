// The design tokens as values (ADR-0015), for places CSS variables can't reach: emails, the PWA
// manifest, the theme Games get in `init`, the Figma library and the contrast test. Components
// don't import this; they use the Tailwind utilities from tokens.css.
import type { Theme } from './semantic.ts';
import { warm } from './themes/warm.ts';

export { contrastPairs, contrastRatio, minimumContrast, type ContrastPair } from './contrast.ts';
export { renderModeVariables, renderTokensCss } from './css.ts';
export { fontWeight, spacing, typeScale, zIndex } from './scales.ts';
export {
  colorRoles,
  modes,
  shapeRoles,
  type ColorRole,
  type Mode,
  type ShapeRole,
  type Theme,
} from './semantic.ts';

/** Every theme. A new brand is a new file in themes/ and an entry here. */
export const themes = { warm } as const satisfies Record<string, Theme>;
export type ThemeName = keyof typeof themes;

/** The theme tokens.css is generated from. */
export const defaultTheme: Theme = warm;
