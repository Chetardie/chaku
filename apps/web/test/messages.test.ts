// CHK-19: both catalogs have the same strings, and Ukrainian plurals use their one, few and many
// forms (D18, voice-and-tone). A key that isn't in the catalog fails the type check.
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../messages/en.json';
import uk from '../messages/uk.json';

/** Every key path in a catalog, like `home.ready`. */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('message catalogs', () => {
  it('have exactly the same keys in English and Ukrainian', () => {
    expect(keys(uk).sort()).toEqual(keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const catalog of [en, uk]) {
      const values = JSON.stringify(catalog);
      expect(values).not.toContain('""');
    }
  });

  it('renders Ukrainian plurals for 1, 2, 5, 11 and 21', () => {
    const t = createTranslator({ locale: 'uk', messages: uk, namespace: 'chats' });
    expect(t('unread', { count: 1 })).toBe('1 непрочитане повідомлення');
    expect(t('unread', { count: 2 })).toBe('2 непрочитані повідомлення');
    expect(t('unread', { count: 5 })).toBe('5 непрочитаних повідомлень');
    expect(t('unread', { count: 11 })).toBe('11 непрочитаних повідомлень');
    expect(t('unread', { count: 21 })).toBe('21 непрочитане повідомлення');
  });

  it('renders English plurals', () => {
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'chats' });
    expect(t('unread', { count: 1 })).toBe('1 unread message');
    expect(t('unread', { count: 3 })).toBe('3 unread messages');
  });

  it('types every key', () => {
    const t = createTranslator({ locale: 'en', messages: en });
    expect(t('home.ready')).toBe("Everything's working.");
    // @ts-expect-error: a key missing from the catalog is a type error.
    expect(() => t('home.missing')).toBeDefined();
  });
});
