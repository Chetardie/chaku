// CHK-19: the interface language comes from the cookie, then the browser, then English, and never
// from the URL (D18, ADR-0011).
import { expect, test } from '@playwright/test';

test.describe('a browser in English', () => {
  test.use({ locale: 'en-GB' });

  test('gets English', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('status')).toHaveText("Everything's working.");
  });

  test('gets Ukrainian when the language cookie says so', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'uk', url: 'https://chaku.localhost' },
    ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.getByRole('status')).toHaveText('Усе працює.');
  });
});

test.describe('a browser in Ukrainian', () => {
  test.use({ locale: 'uk-UA' });

  test('gets Ukrainian', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });
});

test.describe('a browser in a language we do not have', () => {
  test.use({ locale: 'de-DE' });

  test('gets English', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('URLs', () => {
  test.use({ locale: 'uk-UA' });

  test('have no locale prefix: /uk is not a page', async ({ page }) => {
    const response = await page.goto('/uk');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Сторінку не знайдено');
  });
});
