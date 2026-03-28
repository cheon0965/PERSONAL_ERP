'use client';

import { Box, Container } from '@mui/material';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SidebarNav, sidebarWidth } from './sidebar-nav';
import { Topbar } from './topbar';

export function AppShell({ children }: React.PropsWithChildren) {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <SidebarNav />
      <Topbar />
      <Box component="main" sx={{ ml: { lg: `${sidebarWidth}px` }, py: appLayout.mainPaddingY }}>
        <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
}
