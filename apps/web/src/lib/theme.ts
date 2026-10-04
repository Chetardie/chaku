// The Member's light, dark or system choice, stored per device in a cookie (G8, ADR-0015). The
// server puts it on <html> as `data-theme`, so the first paint is right without a script; no cookie
// means system, and tokens.css follows `prefers-color-scheme`. The switch comes with Settings.
import { modes, type Mode } from '@chaku/ui/tokens';

export const themeCookie = 'theme';

/** The mode to put on <html>, or undefined to follow the system. */
export function themeMode(cookie: string | undefined): Mode | undefined {
  return (modes as readonly (string | undefined)[]).includes(cookie) ? (cookie as Mode) : undefined;
}
