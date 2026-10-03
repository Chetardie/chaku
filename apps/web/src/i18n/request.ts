// next-intl's per-request configuration, found through the plugin in next.config.ts.
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import en from '../../messages/en.json';
import uk from '../../messages/uk.json';
import { localeCookie, resolveLocale } from './locale.ts';

const messages = { en, uk };

export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(localeCookie)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
  });
  return { locale, messages: messages[locale] };
});
