'use client';

import { Box, Container } from '@mui/material';
import { appLayout } from '@/shared/ui/layout-metrics';
import { DomainHelpDrawer } from '@/shared/ui/domain-help-drawer';
import { NavigationAccessBoundary } from '@/shared/navigation/navigation-access-boundary';
import { SidebarNav, sidebarWidth } from './sidebar-nav';
import { Topbar } from './topbar';

export function AppShell({ children }: React.PropsWithChildren) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}
    >
      <SidebarNav />
      <Topbar />
      <DomainHelpDrawer />
      <Box
        component="main"
        sx={{ ml: { lg: `${sidebarWidth}px` }, py: appLayout.mainPaddingY }}
      >
        <Container maxWidth="xl">
          <NavigationAccessBoundary>{children}</NavigationAccessBoundary>
        </Container>
      </Box>
    </Box>
  );
}
