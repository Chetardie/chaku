// Nunito for the interface and JetBrains Mono for code, self-hosted by next/font: the files are
// downloaded at build time and served from our origin, so browsers never contact Google (D35).
// The CSS variables feed `font-sans` and `font-mono` in @chaku/ui's tokens.
import { JetBrains_Mono, Nunito } from 'next/font/google';

export const nunito = Nunito({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-nunito',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  // Code is rare on first paint; don't make every page download the font.
  preload: false,
});
