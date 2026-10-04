import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import { themeCookie, themeMode } from '../src/lib/theme.ts';
import { jetbrainsMono, nunito } from './fonts.ts';
import './globals.css';
import { Providers } from './providers.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: 'Chaku', description: t('description') };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = themeMode((await cookies()).get(themeCookie)?.value);
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${nunito.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
