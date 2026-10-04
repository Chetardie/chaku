// WCAG 2.2 AA (spec §4): every page the app has passes axe's automated checks, in light and dark
// mode (CHK-36).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { themeCookie } from '../src/lib/theme.ts';

for (const mode of ['light', 'dark']) {
  for (const path of ['/', '/no-such-page']) {
    test(`${path} in ${mode} mode has no automatically detectable accessibility problems`, async ({
      page,
    }) => {
      await page
        .context()
        .addCookies([{ name: themeCookie, value: mode, url: 'https://chaku.localhost' }]);
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
