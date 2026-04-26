'use client';

import * as React from 'react';
import type { Route } from 'next';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { useAuthSession } from './auth-provider';

export function AuthGuard({ children }: React.PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuthSession();
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;

    if (status === 'loading') {
      timer = setTimeout(() => {
        setIsTimedOut(true);
      }, 10000);
    } else {
      setIsTimedOut(false);
    }

    return () => clearTimeout(timer);
  }, [status]);

  React.useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    const nextPath = pathname?.startsWith('/') ? pathname : '/dashboard';
    router.replace(`/login?next=${encodeURIComponent(nextPath)}` as Route);
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return (
      <Stack
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
        spacing={appLayout.fieldGap}
        sx={{
          backgroundColor: brandTokens.palette.background
        }}
      >
        {isTimedOut ? (
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography variant="body1" color="error.main" fontWeight="bold">
              인증 정보를 불러오는 데 시간이 너무 오래 걸립니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              네트워크 지연이 발생했거나 서버가 응답하지 않을 수 있습니다.
            </Typography>
            <Typography
              variant="button"
              color="primary"
              sx={{ cursor: 'pointer', mt: 2, textDecoration: 'underline' }}
              onClick={() => window.location.reload()}
            >
              화면 다시 불러오기
            </Typography>
          </Stack>
        ) : (
          <>
            <CircularProgress size={32} />
            <Typography variant="body1" color="text.secondary">
              {status === 'loading'
                ? '로그인 상태를 확인하고 있습니다...'
                : '로그인 화면으로 이동하고 있습니다...'}
            </Typography>
          </>
        )}
      </Stack>
    );
  }

  return <>{children}</>;
}
