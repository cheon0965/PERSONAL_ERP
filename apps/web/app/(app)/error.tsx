'use client';
import * as React from 'react';
import { Button, Stack, Typography, Paper } from '@mui/material';

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Optionally log to an error tracking service
    console.error('App scope error caught by boundary:', error);
  }, [error]);

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
          화면을 그리는 도중 에러가 발생하여 잠시 멈췄습니다. (개발 중이시라면 아래 에러 내용을 확인해주세요)
        </Typography>
        
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
          <Typography variant="caption" color="error.main" sx={{ wordBreak: 'break-all' }}>
            {error.message || '알 수 없는 오류'}
          </Typography>
        </Paper>

        <Button 
          variant="contained" 
          onClick={reset}
          disableElevation
        >
          다시 시도
        </Button>
      </Paper>
    </Stack>
  );
}
