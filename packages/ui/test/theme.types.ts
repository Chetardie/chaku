// CHK-36, ADR-0015: a theme that misses a semantic role, or sets one that doesn't exist, is a type
// error. `pnpm typecheck` checks this file: each `@ts-expect-error` must find its error.
import type { Theme } from '../src/tokens/index.ts';
import { warm } from '../src/tokens/themes/warm.ts';

const lightWithoutBubbleOwn: Omit<typeof warm.modes.light, 'bubble-own'> = warm.modes.light;
const shapeWithoutRadiusCard: Omit<typeof warm.shape, 'radius-card'> = warm.shape;

export const complete: Theme = warm;

export const missingColorRole: Theme = {
  name: 'missing-color-role',
  // @ts-expect-error -- `bubble-own` is missing in light mode
  modes: { light: lightWithoutBubbleOwn, dark: warm.modes.dark },
  shape: warm.shape,
};

export const missingMode: Theme = {
  name: 'missing-mode',
  // @ts-expect-error -- there is no dark mode
  modes: { light: warm.modes.light },
  shape: warm.shape,
};

export const missingShapeRole: Theme = {
  name: 'missing-shape-role',
  modes: warm.modes,
  // @ts-expect-error -- `radius-card` is missing
  shape: shapeWithoutRadiusCard,
};

export const unknownRole: Theme = {
  name: 'unknown-role',
  modes: {
    // @ts-expect-error -- `bubble-shadow` is not a semantic role; add it to semantic.ts first
    light: { ...warm.modes.light, 'bubble-shadow': warm.modes.light.border },
    dark: warm.modes.dark,
  },
  shape: warm.shape,
};
