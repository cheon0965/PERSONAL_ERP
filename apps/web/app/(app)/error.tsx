'use client';
import * as React from 'react';
import { Button, Stack, Typography, Paper } from '@mui/material';
import { ErrorDiagnosticsDisclosure } from '@/shared/ui/error-alert-behavior';

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // 필요하면 오류 추적 서비스로 기록한다.
    console.error('App scope error caught by boundary:', error);
  }, [error]);

  const diagnostics = [
    error.message ? `메시지 ${error.message}` : null,
    error.digest ? `오류 식별자 ${error.digest}` : null,
    error.stack ? `스택\n${error.stack}` : null
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');

  return (
    <Stack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      sx={{
        background: '#f5f7fb',
        p: 3
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 480,
          textAlign: 'center',
          borderRadius: 3,
          border: '1px solid #e2e8f0'
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          문제가 발생했습니다
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          화면을 그리는 도중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </Typography>

        {diagnostics ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              bgcolor: '#f8fafc',
              textAlign: 'left',
              overflowX: 'auto'
            }}
          >
            <ErrorDiagnosticsDisclosure diagnostics={diagnostics} />
          </Paper>
        ) : null}

        <Button variant="contained" onClick={reset} disableElevation>
          다시 시도
        </Button>
      </Paper>
    </Stack>
  );
}
