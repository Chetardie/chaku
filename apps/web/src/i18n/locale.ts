// Which language the interface uses (D18). There is no locale in URLs (ADR-0011): the choice is a
// cookie, otherwise the browser's languages, otherwise English. The Member's saved choice
// (`members.locale`) joins this with the language setting.

export const locales = ['en', 'uk'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Set by the language setting; read on every request. */
export const localeCookie = 'NEXT_LOCALE';

export function isLocale(value: string | undefined): value is Locale {
  return (locales as readonly (string | undefined)[]).includes(value);
}

/** The languages in an Accept-Language header, most preferred first, without q=0 ones. */
function acceptedLanguages(header: string): string[] {
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...parameters] = part.trim().split(';');
      const q = parameters
        .map((parameter) => /^\s*q=([\d.]+)\s*$/.exec(parameter)?.[1])
        .find((value) => value !== undefined);
      return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter(({ tag, q }) => tag !== '' && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag);
}

export function resolveLocale(request: {
  cookie: string | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  if (isLocale(request.cookie)) return request.cookie;
  for (const tag of acceptedLanguages(request.acceptLanguage ?? '')) {
    const language = tag.split('-')[0];
    if (isLocale(language)) return language;
  }
  return defaultLocale;
}
