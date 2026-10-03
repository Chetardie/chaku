'use client';

import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '../src/lib/query-client.ts';

export function Providers({ children }: { children: React.ReactNode }) {
  // The realtime engine starts here once per tab, in phase 2.
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
