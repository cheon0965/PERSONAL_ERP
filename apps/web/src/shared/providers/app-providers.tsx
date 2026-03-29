'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/shared/auth/auth-provider';
import { QueryProvider } from '@/shared/providers/query-provider';
import { ThemeRegistry } from '@/shared/providers/theme-registry';

import { DomainHelpProvider } from '@/shared/providers/domain-help-provider';

const ERROR_PATHS = new Set(['/404', '/500', '/_not-found']);

export function AppProviders({ children }: React.PropsWithChildren) {
  const pathname = usePathname();

  if (pathname && ERROR_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <ThemeRegistry>
      <QueryProvider>
        <AuthProvider>
          <DomainHelpProvider>{children}</DomainHelpProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeRegistry>
  );
}
