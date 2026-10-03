// Browser tests against a production build, served by the standalone server and reached through
// Caddy at https://chaku.localhost, as a Member's browser would (D19, ADR-0006). Needs `pnpm stack`
// and `pnpm build`.
import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'https://chaku.localhost',
    // Caddy's local CA is trusted by the developer's system, not by Playwright's browsers.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000/',
    reuseExistingServer: !ci,
    // Caddy reaches the app from its container, so listen beyond loopback.
    env: { HOSTNAME: '0.0.0.0', PORT: '3000' },
    stdout: 'pipe',
  },
});
