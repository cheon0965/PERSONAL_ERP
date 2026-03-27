'use client';

import type { Route } from 'next';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  AppBar,
  Avatar,
  Button,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { sidebarWidth } from './sidebar-nav';

export function Topbar() {
  const router = useRouter();
  const { logout, user } = useAuthSession();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="inherit"
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        ml: { lg: `${sidebarWidth}px` },
        width: { lg: `calc(100% - ${sidebarWidth}px)` }
      }}
    >
      <Toolbar sx={{ minHeight: 72 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" gap={2}>
          <TextField
            size="small"
            placeholder="Search pages, rules, or transactions"
            InputProps={{
              startAdornment: <SearchRoundedIcon fontSize="small" style={{ marginRight: 8 }} />
            }}
            sx={{ maxWidth: 420 }}
          />
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton>
              <NotificationsRoundedIcon />
            </IconButton>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}
            >
              <Stack spacing={0} textAlign="right" sx={{ display: { xs: 'none', md: 'flex' } }}>
                <Typography variant="body2" fontWeight={700}>
                  {user?.name ?? 'Workspace User'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email ?? 'Not signed in'}
                </Typography>
              </Stack>
              <Avatar sx={{ width: 36, height: 36 }}>
                {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
              </Avatar>
              <Button
                variant="text"
                color="inherit"
                startIcon={<LogoutRoundedIcon />}
                onClick={() => {
                  void logout();
                  router.replace('/login' as Route);
                }}
              >
                Sign out
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
