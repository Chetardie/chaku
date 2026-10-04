// Semantic roles: the names components use (ADR-0015). shadcn/ui's names come first so its
// components work unchanged; Chaku's own roles follow. Every theme sets every role in every mode,
// which the `Theme` type enforces.

/** shadcn/ui's colour roles. `destructive` is the same colour as `danger`. */
const shadcnColorRoles = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
] as const;

/** Chaku's colour roles. Each fill that carries text has a `-foreground` partner. */
const chakuColorRoles = [
  'chat-background',
  'bubble-own',
  'bubble-own-foreground',
  'bubble-other',
  'bubble-other-foreground',
  // Sun yellow, for Game Challenges only.
  'challenge',
  'challenge-foreground',
  'presence-online',
  'unread',
  'unread-foreground',
  'mention',
  'mention-foreground',
  // Group Chats colour each Participant's name with one of these, picked by Member ID.
  'participant-1',
  'participant-2',
  'participant-3',
  'participant-4',
  'participant-5',
  'participant-6',
  'participant-7',
  'participant-8',
  // Status colours work as text on `background` and `card`, and as fills under their foreground.
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'danger',
  'danger-foreground',
  'info',
  'info-foreground',
] as const;

export const colorRoles = [...shadcnColorRoles, ...chakuColorRoles] as const;
export type ColorRole = (typeof colorRoles)[number];

/** Roles that don't change with the mode, but may change with the theme. */
export const shapeRoles = [
  'radius-bubble',
  'radius-bubble-tail',
  'radius-card',
  'radius-pill',
  'font-sans',
  'font-mono',
] as const;
export type ShapeRole = (typeof shapeRoles)[number];

export const modes = ['light', 'dark'] as const;
export type Mode = (typeof modes)[number];

/** A theme sets every colour role in each mode, and every shape role once. */
export interface Theme {
  readonly name: string;
  readonly modes: { readonly [M in Mode]: Readonly<Record<ColorRole, string>> };
  readonly shape: Readonly<Record<ShapeRole, string>>;
}
