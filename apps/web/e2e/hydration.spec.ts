// CHK-19: the first page comes from the server with its data, prefetched in-process and hydrated
// into TanStack Query, so the browser doesn't fetch it again (D50, web data flow doc).
import { expect, test } from '@playwright/test';

test('the first load shows server data without calling /rpc', async ({ page }) => {
  const rpcCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/rpc')) rpcCalls.push(request.url());
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  // Rendered on the server: the status is in the HTML before any script runs.
  expect(await response?.text()).toContain('data-health="ok"');

  await expect(page.getByRole('status')).toHaveText("Everything's working.");
  await page.waitForLoadState('networkidle');
  expect(rpcCalls).toEqual([]);
});

test('the browser client calls /rpc with the CSRF header', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('/rpc/health/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': 'orpc' },
      body: JSON.stringify({}),
    });
    return { status: response.status, body: (await response.json()) as unknown };
  });
  expect(result).toEqual({ status: 200, body: { json: { status: 'ok' } } });
});
