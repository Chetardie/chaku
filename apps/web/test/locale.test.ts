// CHK-19: the interface language is the cookie's, then the browser's, then English (D18).
import { describe, expect, it } from 'vitest';

import { resolveLocale } from '../src/i18n/locale.ts';

describe('resolveLocale', () => {
  it.each([
    ['the cookie, over the browser', { cookie: 'uk', acceptLanguage: 'en-GB,en' }, 'uk'],
    ['the cookie for English', { cookie: 'en', acceptLanguage: 'uk' }, 'en'],
    [
      'the browser when there is no cookie',
      { cookie: undefined, acceptLanguage: 'uk-UA,uk;q=0.9' },
      'uk',
    ],
    ['the browser when the cookie is unknown', { cookie: 'fr', acceptLanguage: 'uk' }, 'uk'],
    [
      'the first language we have',
      { cookie: undefined, acceptLanguage: 'de, uk;q=0.8, en;q=0.5' },
      'uk',
    ],
    ['by preference, not order', { cookie: undefined, acceptLanguage: 'en;q=0.3, uk;q=0.9' }, 'uk'],
    ['never a language with q=0', { cookie: undefined, acceptLanguage: 'uk;q=0, en;q=0.1' }, 'en'],
    ['English when nothing matches', { cookie: undefined, acceptLanguage: 'de-DE, fr' }, 'en'],
    ['English with no header', { cookie: undefined, acceptLanguage: null }, 'en'],
  ] as const)('uses %s', (_, request, expected) => {
    expect(resolveLocale(request)).toBe(expected);
  });
});
