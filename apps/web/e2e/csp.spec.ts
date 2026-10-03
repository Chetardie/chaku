// CHK-19: a production build runs under its strict CSP without a single violation (D9, D35).
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Collected before any page script runs, so nothing escapes.
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
});

for (const path of ['/', '/no-such-page']) {
  test(`${path} loads with no CSP violations`, async ({ page }) => {
    const console: string[] = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) console.push(message.text());
    });

    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const violations = await page.evaluate(
      () => (window as unknown as { cspViolations: string[] }).cspViolations,
    );
    expect(violations).toEqual([]);
    expect(console).toEqual([]);
  });
}

test('every script carries the nonce from this response', async ({ page }) => {
  const response = await page.goto('/');
  const policy = (await response?.headerValue('content-security-policy')) ?? '';
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();

  const scripts = await page
    .locator('script')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(new Set(scripts)).toEqual(new Set([nonce]));
});

test('two loads get different nonces', async ({ page }) => {
  const nonce = async () =>
    /'nonce-([^']+)'/.exec(
      (await (await page.goto('/'))?.headerValue('content-security-policy')) ?? '',
    )?.[1];
  expect(await nonce()).not.toBe(await nonce());
});
