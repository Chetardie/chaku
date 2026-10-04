// Scales every theme shares: spacing, type and stacking. They replace Tailwind's defaults, so only
// these steps exist as utilities (`p-4`, `text-base`, `font-semibold`, `z-dialog`).
import { radius } from './primitives.ts';

/** 4px base: `p-1` is 4px, `p-4` is 16px, `gap-6` is 24px. */
export const spacing = '0.25rem';

/** Font sizes with their line heights. Body text is 16px, which also stops iOS zooming into inputs. */
export const typeScale = {
  xs: { size: '0.75rem', lineHeight: '1rem' }, // 12px: badges, counters
  sm: { size: '0.875rem', lineHeight: '1.25rem' }, // 14px: timestamps, secondary text
  base: { size: '1rem', lineHeight: '1.5rem' }, // 16px: body text, Messages
  lg: { size: '1.125rem', lineHeight: '1.625rem' }, // 18px
  xl: { size: '1.25rem', lineHeight: '1.75rem' }, // 20px: screen titles
  '2xl': { size: '1.5rem', lineHeight: '2rem' }, // 24px
  '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px: onboarding
} as const;

/** The three weights foundations allows: body, names and labels, titles. */
export const fontWeight = { normal: '400', semibold: '600', extrabold: '800' } as const;

/** Stacking layers, lowest first. Floating things get a layer here, never a bare number. */
export const zIndex = {
  base: '0',
  sticky: '10', // sticky headers, the composer
  'mini-player': '20', // the Mini Player over a Chat
  popover: '30', // menus, pickers
  overlay: '40', // the scrim under sheets and dialogs
  dialog: '50', // sheets and dialogs
  toast: '60',
  tooltip: '70',
} as const;

/** Radius steps for shadcn/ui's `rounded-sm` to `rounded-2xl`; `rounded-full` is built in. */
export const radiusSteps = {
  xs: radius.xs,
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
  '2xl': radius['2xl'],
} as const;
