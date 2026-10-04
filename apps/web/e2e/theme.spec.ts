// CHK-36, G8, ADR-0015: the page paints in the Warm theme with Nunito, and the theme cookie picks
// the mode on the server, so the first paint is right with no script. These tests run with
// JavaScript off: what they see is what the server sent.
import { defaultTheme } from '@chaku/ui/tokens';
import { expect, test, type Page } from '@playwright/test';

import { themeCookie } from '../src/lib/theme.ts';

const { light, dark } = defaultTheme.modes;

test.use({ javaScriptEnabled: false });

/** The computed colours of <body> and of a hex value, in the browser's own format. */
async function bodyBackground(page: Page, hex: string): Promise<{ body: string; token: string }> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const token = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { body: getComputedStyle(document.body).backgroundColor, token };
  }, hex);
}

async function setTheme(page: Page, value: string): Promise<void> {
  await page.context().addCookies([{ name: themeCookie, value, url: 'https://chaku.localhost' }]);
}

test('a first visit gets the cream background and Nunito', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  const { body, token } = await bodyBackground(page, light.background);
  expect(body).toBe(token);

  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toMatch(/^"?Nunito/);
  // The font is served by our origin (D35), and the body text renders in it.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px Nunito'))).toBe(true);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family),
  );
  expect(loaded.join()).toContain('Nunito');
});

test('the dark cookie makes the server send dark mode on first paint', async ({ page }) => {
  await setTheme(page, 'dark');
  const response = await page.goto('/');
  expect(await response?.text()).toMatch(/<html[^>]* data-theme="dark"/);
  const { body, token } = await bodyBackground(page, dark.background);
  expect(body).toBe(token);
});

test.describe('a system in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('gets dark mode without a cookie', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    const { body, token } = await bodyBackground(page, dark.background);
    expect(body).toBe(token);
  });

  test('gets light mode when the cookie says light', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const { body, token } = await bodyBackground(page, light.background);
    expect(body).toBe(token);
  });
});

test('an unknown cookie value follows the system', async ({ page }) => {
  await setTheme(page, 'sepia');
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});
