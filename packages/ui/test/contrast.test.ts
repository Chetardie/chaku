// CHK-36, ADR-0015, D18: every listed foreground and background pair passes WCAG 2.2 AA in every
// mode of every theme: 4.5:1 for text, 3:1 for large text and UI parts.
import { describe, expect, it } from 'vitest';

import {
  contrastPairs,
  contrastRatio,
  minimumContrast,
  modes,
  themes,
  type ColorRole,
} from '../src/tokens/index.ts';

describe('contrastRatio', () => {
  it('follows WCAG 2.2', () => {
    // eslint-disable-next-line no-restricted-syntax -- reference values for the formula
    const [black, white, coral] = ['#000000', '#FFFFFF', '#C8461B'] as const;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(white, coral)).toBe(contrastRatio(coral, white));
    // foundations.md: white text on coral is 4.8:1.
    expect(contrastRatio(white, coral)).toBeCloseTo(4.83, 2);
  });
});

describe('contrast pairs', () => {
  const listed = (foreground: ColorRole, background: ColorRole) =>
    contrastPairs.some((pair) => pair.foreground === foreground && pair.background === background);

  it.each([
    ['foreground', 'background'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['muted-foreground', 'chat-background'],
    ['bubble-own-foreground', 'bubble-own'],
    ['bubble-other-foreground', 'bubble-other'],
    ['primary-foreground', 'primary'],
    ['challenge-foreground', 'challenge'],
    ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [
      [`participant-${String(n)}`, 'chat-background'],
      [`participant-${String(n)}`, 'card'],
    ]),
    ...['success', 'warning', 'danger', 'info'].map((status) => [`${status}-foreground`, status]),
  ] as [ColorRole, ColorRole][])('include %s on %s', (foreground, background) => {
    expect(listed(foreground, background)).toBe(true);
  });
});

describe.each(Object.values(themes).map((theme) => [theme.name, theme] as const))(
  'theme %s',
  (_, theme) => {
    describe.each(modes)('%s mode', (mode) => {
      it.each(
        contrastPairs.map((pair) => [pair.foreground, pair.background, pair.kind, pair] as const),
      )('%s on %s passes AA for %s', (_foreground, _background, _kind, pair) => {
        const ratio = contrastRatio(
          theme.modes[mode][pair.foreground],
          theme.modes[mode][pair.background],
        );
        expect(ratio).toBeGreaterThanOrEqual(minimumContrast[pair.kind]);
      });
    });
  },
);
