// WCAG 2.2 contrast (D18) and the role pairs every theme must pass in every mode (ADR-0015).
import type { ColorRole } from './semantic.ts';

/** Relative luminance of an sRGB hex colour (`#RRGGBB`), as WCAG 2.2 defines it. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** 4.5:1 for text, 3:1 for large text and UI parts such as focus rings and input borders. */
export const minimumContrast = { text: 4.5, ui: 3 } as const;

export interface ContrastPair {
  readonly foreground: ColorRole;
  readonly background: ColorRole;
  readonly kind: keyof typeof minimumContrast;
}

const text = (foreground: ColorRole, ...backgrounds: ColorRole[]): ContrastPair[] =>
  backgrounds.map((background) => ({ foreground, background, kind: 'text' }));
const ui = (foreground: ColorRole, ...backgrounds: ColorRole[]): ContrastPair[] =>
  backgrounds.map((background) => ({ foreground, background, kind: 'ui' }));

const participants = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `participant-${String(n)}` as ColorRole);
const statuses = ['success', 'warning', 'danger', 'info'] as const;

/** Every pair a theme must pass. Add a pair here when a component puts one role on another. */
export const contrastPairs: readonly ContrastPair[] = [
  ...text('foreground', 'background', 'chat-background', 'muted', 'secondary'),
  ...text('card-foreground', 'card'),
  ...text('popover-foreground', 'popover'),
  ...text('muted-foreground', 'background', 'card', 'chat-background', 'muted'),
  ...text('secondary-foreground', 'secondary'),
  ...text('accent-foreground', 'accent'),
  ...text('primary-foreground', 'primary'),
  ...text('bubble-own-foreground', 'bubble-own'),
  ...text('bubble-other-foreground', 'bubble-other'),
  ...text('challenge-foreground', 'challenge'),
  ...text('unread-foreground', 'unread'),
  ...text('mention-foreground', 'mention'),
  // Participant names sit on other people's bubbles, on cards and on the Chat background.
  ...participants.flatMap((role) => text(role, 'chat-background', 'card', 'bubble-other')),
  // Status colours as text (form errors, "Saved"), and as fills under their foreground.
  ...statuses.flatMap((role) => [
    ...text(role, 'background', 'card'),
    ...text(`${role}-foreground`, role),
  ]),
  ...text('danger-foreground', 'destructive'),
  // UI parts: input borders, focus rings, the online dot, coral buttons and badges on the page.
  ...ui('input', 'background', 'card', 'chat-background'),
  ...ui('ring', 'background', 'card', 'chat-background'),
  ...ui('presence-online', 'background', 'card'),
  ...ui('primary', 'background', 'card'),
  ...ui('unread', 'background', 'card'),
];
