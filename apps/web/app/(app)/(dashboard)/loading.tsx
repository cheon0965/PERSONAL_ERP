import * as React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

export default function DashboardLoading() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Topbar Skeleton */}
      <Box sx={{ height: 60, borderBottom: '1px solid #e2e8f0', p: 2, display: 'flex', alignItems: 'center' }}>
        <Skeleton variant="rectangular" width={200} height={28} />
        <Box sx={{ flexGrow: 1 }} />
        <Skeleton variant="circular" width={32} height={32} />
      </Box>
      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        {/* Sidebar Skeleton */}
        <Box sx={{ width: 240, borderRight: '1px solid #e2e8f0', p: 2 }}>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </Stack>
        </Box>
        {/* Main Content Skeleton */}
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Stack spacing={3}>
            <Skeleton variant="text" sx={{ fontSize: '2rem', width: 250 }} />
            <Skeleton variant="rectangular" height={160} />
            <Skeleton variant="rectangular" height={400} />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
