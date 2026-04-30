'use client';

import * as React from 'react';
import { Box, Container } from '@mui/material';
import { appLayout } from '@/shared/ui/layout-metrics';
import { DomainHelpDrawer } from '@/shared/ui/domain-help-drawer';
import { NavigationAccessBoundary } from '@/shared/navigation/navigation-access-boundary';
import { SidebarNav, sidebarWidth } from './sidebar-nav';
import { Topbar } from './topbar';

export function AppShell({ children }: React.PropsWithChildren) {
  const [mobileNavigationOpen, setMobileNavigationOpen] =
    React.useState(false);
  const openMobileNavigation = React.useCallback(() => {
    setMobileNavigationOpen(true);
  }, []);
  const closeMobileNavigation = React.useCallback(() => {
    setMobileNavigationOpen(false);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}
    >
      <SidebarNav
        mobileOpen={mobileNavigationOpen}
        onMobileClose={closeMobileNavigation}
      />
      <Topbar onOpenNavigation={openMobileNavigation} />
      <DomainHelpDrawer />
      <Box
        component="main"
        sx={{
          ml: { lg: `${sidebarWidth}px` },
          width: { xs: '100%', lg: `calc(100% - ${sidebarWidth}px)` },
          minWidth: 0,
          py: appLayout.mainPaddingY,
          px: { xs: 1.5, sm: 2, md: 2.5, lg: 3 }
        }}
      >
        <Container maxWidth="xl" disableGutters sx={{ minWidth: 0 }}>
          <NavigationAccessBoundary>{children}</NavigationAccessBoundary>
        </Container>
      </Box>
    </Box>
  );
}
