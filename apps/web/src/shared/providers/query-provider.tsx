'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isUnauthorizedRequestError } from '@/shared/api/fetch-json';

export function QueryProvider({ children }: React.PropsWithChildren) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            retry: (failureCount, error) =>
              !isUnauthorizedRequestError(error) && failureCount < 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
