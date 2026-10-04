import path from 'node:path';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';

const configDir = path.join(import.meta.dirname, '.storybook');

/** Every story rendered in Chromium with the accessibility checks, once per mode (ADR-0015). */
function storybook(mode: 'light' | 'dark'): TestProjectInlineConfiguration {
  return {
    plugins: [storybookTest({ configDir, initialGlobals: { mode } })],
    test: {
      name: `storybook-${mode}`,
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['test/**/*.test.ts'], environment: 'node' } },
      storybook('light'),
      storybook('dark'),
    ],
  },
});
