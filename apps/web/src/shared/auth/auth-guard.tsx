'use client';

import * as React from 'react';
import type { Route } from 'next';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from './auth-provider';

export function AuthGuard({ children }: React.PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuthSession();

  React.useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    const nextPath = pathname?.startsWith('/') ? pathname : '/dashboard';
    router.replace(
      `/login?next=${encodeURIComponent(nextPath)}` as Route
    );
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return (
      <Stack
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{
          background:
            'radial-gradient(circle at top, rgba(37, 99, 235, 0.12), transparent 42%), #f5f7fb'
        }}
      >
        <CircularProgress size={32} />
        <Typography variant="body1" color="text.secondary">
          {status === 'loading'
            ? 'Restoring your workspace session...'
            : 'Moving you to the sign-in screen...'}
        </Typography>
      </Stack>
    );
  }

  return <>{children}</>;
}
