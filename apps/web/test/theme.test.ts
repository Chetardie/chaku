// CHK-36, G8: the theme cookie sets the mode on <html>; anything else follows the system.
import { describe, expect, it } from 'vitest';

import { themeMode } from '../src/lib/theme.ts';

describe('themeMode', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    [undefined, undefined],
    ['system', undefined],
    ['Dark', undefined],
    ['', undefined],
  ])('turns the cookie %j into %j', (cookie, mode) => {
    expect(themeMode(cookie)).toBe(mode);
  });
});
