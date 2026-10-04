// Tailwind 4 through PostCSS (ADR-0011). Its theme is in @chaku/ui's tokens.css, read by app/globals.css.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
