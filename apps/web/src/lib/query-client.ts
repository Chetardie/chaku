// The TanStack Query client (web data flow doc): a new one for every server request, so no Member's
// data ends up in another Member's HTML, and one per tab in the browser.
import { ORPCError } from '@orpc/client';
import {
  StandardRPCJsonSerializer,
  type StandardRPCJsonSerializedMetaItem,
} from '@orpc/client/standard';
import { environmentManager, hashKey, QueryClient } from '@tanstack/react-query';

// Keeps Dates, Maps and the like intact through dehydration and in query key hashes.
const serializer = new StandardRPCJsonSerializer();

interface Serialized {
  json: unknown;
  meta: StandardRPCJsonSerializedMetaItem[];
}

/** 4xx errors are answers, not failures: retrying won't change them. */
function isClientError(error: unknown): boolean {
  return error instanceof ORPCError && error.status >= 400 && error.status < 500;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Hydrated data isn't refetched on mount.
        staleTime: 60_000,
        retry: (count, error) => count < 2 && !isClientError(error),
        queryKeyHashFn(queryKey) {
          const [json, meta] = serializer.serialize(queryKey);
          return hashKey([json, meta.map((item) => JSON.stringify(item)).sort()]);
        },
      },
      dehydrate: {
        serializeData(data: unknown): Serialized {
          const [json, meta] = serializer.serialize(data);
          return { json, meta };
        },
      },
      hydrate: {
        deserializeData(data: Serialized) {
          return serializer.deserialize(data.json, data.meta);
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
