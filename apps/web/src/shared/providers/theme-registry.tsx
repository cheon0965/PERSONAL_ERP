'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { appTheme } from '@/shared/theme';
import { useCspNonce } from '@/shared/security/csp-nonce';

export function ThemeRegistry({ children }: React.PropsWithChildren) {
  const nonce = useCspNonce();

  return (
    <AppRouterCacheProvider options={{ key: 'mui', nonce }}>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
