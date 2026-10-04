// Primitives: the raw values, named by what they are (ADR-0015). Only theme files read them;
// components use the semantic roles in themes/*.ts through Tailwind utilities.
//
// The colour scales are steps 50 (lightest) to 950 (darkest) on an even OKLCH lightness ladder.
// cream, ink, coral and sun grow from the seeds in docs/design-system/foundations.md, which keep
// their exact values: cream-50 and -100, ink-50, -300, -600, -900 and -950, coral-50, -100, -400,
// -600, -700 and -800, sun-200 and -900. The other hue families (rose to plum) give the Participant
// name colours and the status colours; their middle steps are the most saturated.

/** One colour family, as sRGB hex. */
export type Scale = Readonly<
  Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>
>;

export const white = '#FFFFFF';

export const cream = {
  50: '#FFF7EF',
  100: '#F6EBDF',
  200: '#E8DCD0',
  300: '#D6C8B9',
  400: '#BEAE9E',
  500: '#A29282',
  600: '#877768',
  700: '#6C5E4F',
  800: '#514539',
  900: '#382E25',
  950: '#241E18',
} as const satisfies Scale;

export const ink = {
  50: '#F5EDE6',
  100: '#E8DBD3',
  200: '#D5C4B9',
  300: '#B8A598',
  400: '#A08A7C',
  500: '#8B7567',
  600: '#7A604F',
  700: '#5E4B3F',
  800: '#443429',
  900: '#2B1D14',
  950: '#1C1512',
} as const satisfies Scale;

export const coral = {
  50: '#FFF4EC',
  100: '#FFE4D3',
  200: '#FFC4AD',
  300: '#FFA686',
  400: '#FF8A5C',
  500: '#E5663D',
  600: '#C8461B',
  700: '#A8472A',
  800: '#9A3412',
  900: '#742305',
  950: '#4D1705',
} as const satisfies Scale;

export const sun = {
  50: '#FFF6D9',
  100: '#FFEDB4',
  200: '#FFE08A',
  300: '#F5D06B',
  400: '#E8BF47',
  500: '#CFA50D',
  600: '#A88000',
  700: '#856400',
  800: '#634900',
  900: '#3F2D00',
  950: '#2C1D00',
} as const satisfies Scale;

export const rose = {
  50: '#FFEEEE',
  100: '#FFDEDE',
  200: '#FFC3C4',
  300: '#FFA2A5',
  400: '#FB868C',
  500: '#DE676F',
  600: '#BF4B55',
  700: '#A43944',
  800: '#882A34',
  900: '#691F27',
  950: '#47151A',
} as const satisfies Scale;

export const amber = {
  50: '#FFF2E0',
  100: '#FFE2BF',
  200: '#FFCC9B',
  300: '#F8B477',
  400: '#E59B56',
  500: '#CA7E32',
  600: '#AC6306',
  700: '#935000',
  800: '#793E00',
  900: '#5E2F00',
  950: '#3F2000',
} as const satisfies Scale;

export const olive = {
  50: '#F9F8E2',
  100: '#F0EEC3',
  200: '#E0DDA1',
  300: '#CDC880',
  400: '#B8B260',
  500: '#9C963E',
  600: '#817A1E',
  700: '#6C6606',
  800: '#585200',
  900: '#433F00',
  950: '#2D2A03',
} as const satisfies Scale;

export const green = {
  50: '#E8FEEA',
  100: '#CEF8D3',
  200: '#B0EAB7',
  300: '#92D89B',
  400: '#74C381',
  500: '#54A763',
  600: '#378B49',
  700: '#247638',
  800: '#175F2A',
  900: '#114A1F',
  950: '#0D3115',
} as const satisfies Scale;

export const teal = {
  50: '#E3FDFC',
  100: '#C5F7F6',
  200: '#A2E8E7',
  300: '#7ED6D5',
  400: '#5BC1C0',
  500: '#32A5A5',
  600: '#008989',
  700: '#007374',
  800: '#005E5E',
  900: '#004848',
  950: '#003031',
} as const satisfies Scale;

export const blue = {
  50: '#E7F9FF',
  100: '#D3EEFF',
  200: '#B3DDFF',
  300: '#8FC9FF',
  400: '#72B2F9',
  500: '#5296DF',
  600: '#367AC1',
  700: '#2565A7',
  800: '#18518A',
  900: '#113E6B',
  950: '#0C2A48',
} as const satisfies Scale;

export const violet = {
  50: '#F8F3FF',
  100: '#EDE5FF',
  200: '#DDCEFF',
  300: '#CAB3FF',
  400: '#B59AFE',
  500: '#9A7DE3',
  600: '#7F62C5',
  700: '#6B4EAA',
  800: '#563D8D',
  900: '#422E6E',
  950: '#2C1F4A',
} as const satisfies Scale;

export const plum = {
  50: '#FFEEFC',
  100: '#FFDAF5',
  200: '#FFC1E7',
  300: '#F8A7D4',
  400: '#E58DC0',
  500: '#C970A4',
  600: '#AB5589',
  700: '#924273',
  800: '#78335D',
  900: '#5D2648',
  950: '#3F1A30',
} as const satisfies Scale;

/** Font stacks. `--font-nunito` and `--font-jetbrains-mono` are set by `next/font` in the web app;
 * elsewhere (Storybook, emails) the named family or the system fallback is used. */
export const fontFamily = {
  nunito: 'var(--font-nunito, "Nunito"), ui-rounded, system-ui, sans-serif',
  jetbrainsMono:
    'var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

/** Corner radius steps. */
export const radius = {
  xs: '0.25rem', // 4px
  sm: '0.375rem', // 6px
  md: '0.625rem', // 10px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  '2xl': '1.25rem', // 20px
  full: '9999px',
} as const;
