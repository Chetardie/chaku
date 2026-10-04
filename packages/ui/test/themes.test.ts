// CHK-36, ADR-0015: every theme sets every semantic role in every mode, as a value other tools
// (emails, the PWA manifest, Games, Figma) can read without CSS.
import { describe, expect, it } from 'vitest';

import { colorRoles, defaultTheme, modes, shapeRoles, themes } from '../src/tokens/index.ts';

describe.each(Object.entries(themes))('theme %s', (name, theme) => {
  it('is named after its key', () => {
    expect(theme.name).toBe(name);
  });

  it.each(modes)('sets exactly the colour roles in %s mode, each as #RRGGBB', (mode) => {
    expect(Object.keys(theme.modes[mode]).sort()).toEqual([...colorRoles].sort());
    for (const role of colorRoles) expect(theme.modes[mode][role]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it.each(modes)(
    'gives each Participant its own colour, none of them a status colour, in %s mode',
    (mode) => {
      const values = theme.modes[mode];
      const participants = colorRoles
        .filter((role) => role.startsWith('participant-'))
        .map((role) => values[role]);
      const statuses = (['success', 'warning', 'danger', 'info', 'presence-online'] as const).map(
        (role) => values[role],
      );
      expect(new Set(participants).size).toBe(8);
      for (const colour of participants) expect(statuses).not.toContain(colour);
    },
  );

  it('sets exactly the shape roles', () => {
    expect(Object.keys(theme.shape).sort()).toEqual([...shapeRoles].sort());
  });
});

/* eslint-disable no-restricted-syntax -- the values the screen map proposed */
describe('screen map design notes 1 and 2', () => {
  it('makes the Chat background deeper than the page in light mode', () => {
    expect(defaultTheme.modes.light['chat-background']).toBe('#F6EBDF');
    expect(defaultTheme.modes.light.background).toBe('#FFF7EF');
  });

  it('makes own bubbles a deeper coral in dark mode, keeping bright coral for primary', () => {
    expect(defaultTheme.modes.dark['bubble-own']).toBe('#A8472A');
    expect(defaultTheme.modes.dark['bubble-own-foreground']).toBe('#FFF4EC');
    expect(defaultTheme.modes.dark.primary).toBe('#FF8A5C');
  });
});
