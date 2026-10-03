import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { HealthStatus } from '../src/components/health-status.tsx';
import { orpc } from '../src/lib/orpc.ts';
import { getQueryClient } from '../src/lib/query-client.ts';

// The home page until the app has screens: it proves the data path from a Server Component,
// through the in-process router client, into the browser's cache (web data flow doc).
export default async function HomePage() {
  const t = await getTranslations('home');
  const queryClient = getQueryClient();
  // An extra, not the page's main item: on failure the client component retries and shows its
  // error boundary (web data flow doc).
  await queryClient.query(orpc.health.check.queryOptions()).catch(() => undefined);
  return (
    <main>
      <h1>Chaku</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<p>{t('checking')}</p>}>
          <HealthStatus />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
