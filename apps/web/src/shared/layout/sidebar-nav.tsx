'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography
} from '@mui/material';
import { navigationItems } from '@/shared/config/navigation';

const drawerWidth = 264;

export function SidebarNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? '';

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        display: { xs: 'none', lg: 'block' },
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }
      }}
      open
    >
      <Toolbar>
        <Box>
          <Typography variant="h6">PERSONAL ERP</Typography>
          <Typography variant="body2" color="text.secondary">
            1인 사업자·소상공인 월 운영 시스템
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ p: 2 }}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const selected =
            currentPath === item.href ||
            currentPath.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block'
              }}
            >
              <ListItemButton
                selected={selected}
                sx={{ borderRadius: 3, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon color={selected ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </Link>
          );
        })}
      </List>
    </Drawer>
  );
}

export const sidebarWidth = drawerWidth;
