// Types every translation call: a key that isn't in the English catalog fails the type check.
// messages.test.ts checks that the Ukrainian catalog has exactly the same keys.
import type en from '../../messages/en.json';
import type { Locale as AppLocale } from './locale.ts';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof en;
  }
}
