'use client';

import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { AppBar, Avatar, IconButton, Stack, TextField, Toolbar } from '@mui/material';
import { sidebarWidth } from './sidebar-nav';

export function Topbar() {
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
            <Avatar sx={{ width: 36, height: 36 }}>D</Avatar>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
