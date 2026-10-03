'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { orpc } from '../lib/orpc.ts';

export function HealthStatus() {
  const t = useTranslations('home');
  // Hydrated from the server's prefetch, so this doesn't fetch on first load.
  const { data } = useSuspenseQuery(orpc.health.check.queryOptions());
  return (
    <p role="status" data-health={data.status}>
      {t('ready')}
    </p>
  );
}
