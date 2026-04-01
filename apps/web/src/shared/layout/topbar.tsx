'use client';

import type { Route } from 'next';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  AppBar,
  Avatar,
  Button,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelpStore } from '../providers/domain-help-provider';
import { sidebarWidth } from './sidebar-nav';

export function Topbar() {
  const router = useRouter();
  const { logout, user } = useAuthSession();
  const { activeContext, setDrawerOpen } = useDomainHelpStore();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="inherit"
      sx={{
        borderRadius: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        ml: { lg: `${sidebarWidth}px` },
        width: { lg: `calc(100% - ${sidebarWidth}px)` }
      }}
    >
      <Toolbar sx={{ minHeight: 72 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          width="100%"
          gap={2}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip
              title={
                activeContext ? '도메인 가이드 열기' : '도움말 정보가 없습니다'
              }
            >
              <span>
                <IconButton
                  disabled={!activeContext}
                  onClick={() => setDrawerOpen(true)}
                  color="primary"
                >
                  <HelpOutlineRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}
            >
              <Stack
                spacing={0}
                textAlign="right"
                sx={{ display: { xs: 'none', md: 'flex' } }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {user?.name ?? '워크스페이스 사용자'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email ?? '로그인되지 않음'}
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
                로그아웃
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
