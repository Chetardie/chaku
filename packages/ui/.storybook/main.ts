// Storybook for @chaku/ui (ADR-0011, ADR-0015): stories next to the components, Tailwind with the
// same tokens.css as the web app, and the accessibility addon, whose checks run as Vitest tests.
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    return mergeConfig(config, { plugins: [tailwindcss()] });
  },
});
