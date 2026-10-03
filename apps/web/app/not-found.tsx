import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <Link href="/">{t('home')}</Link>
    </main>
  );
}
