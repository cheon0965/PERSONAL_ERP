'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alpha } from '@mui/material/styles';
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
import { navigationSections } from '@/shared/config/navigation';

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
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))',
          overflowY: 'auto'
        }
      }}
      open
    >
      <Toolbar sx={{ alignItems: 'flex-start', minHeight: 86 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main">
            월별 운영
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            PERSONAL ERP
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            월 운영 ERP
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <Box sx={{ px: 1.5, py: 2 }}>
        {navigationSections.map((section, sectionIndex) => (
          <Box key={section.label} sx={{ mb: sectionIndex === navigationSections.length - 1 ? 0 : 2 }}>
            {sectionIndex > 0 ? <Divider sx={{ mb: 2 }} /> : null}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 1.5, display: 'block' }}
            >
              {section.label}
            </Typography>
            <List disablePadding sx={{ mt: 0.75 }}>
              {section.items.map((item) => {
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
                      sx={(theme) => ({
                        borderRadius: 3,
                        mb: 0.5,
                        px: 1.5,
                        ...(selected
                          ? {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1
                              )
                            }
                          : null)
                      })}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Icon color={selected ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  </Link>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}

export const sidebarWidth = drawerWidth;
