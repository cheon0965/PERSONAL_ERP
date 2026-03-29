import * as React from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';

export default function AppLoading() {
  return (
    <Stack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      spacing={3}
      sx={{ background: '#f5f7fb' }}
    >
      <CircularProgress size={40} thickness={4} color="primary" sx={{ opacity: 0.8 }} />
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        앱 초기화 중입니다...
      </Typography>
    </Stack>
  );
}
