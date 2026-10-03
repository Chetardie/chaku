'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { browserErrors } from '../src/lib/errors.ts';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');
  useEffect(() => {
    // The digest matches the server's log line for the same error.
    browserErrors.capture(error, error.digest ? { tags: { digest: error.digest } } : {});
  }, [error]);
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <button type="button" onClick={reset}>
        {t('retry')}
      </button>
    </main>
  );
}
