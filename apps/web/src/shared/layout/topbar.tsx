'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Popover,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { membershipRoleLabelMap } from '@/shared/auth/auth-labels';
import { useDomainHelpStore } from '../providers/domain-help-provider';
import { sidebarWidth } from './sidebar-nav';

export function Topbar() {
  const router = useRouter();
  const { logout, user } = useAuthSession();
  const { activeContext, setDrawerOpen } = useDomainHelpStore();
  const currentWorkspace = user?.currentWorkspace ?? null;
  const ledger = currentWorkspace?.ledger ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const [contextAnchorEl, setContextAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const contextPopoverOpen = Boolean(contextAnchorEl);
  const handleContextClose = React.useCallback(() => {
    setContextAnchorEl(null);
  }, []);

  return (
    <>
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
        <Toolbar
          sx={{
            minHeight: 72,
            gap: 2,
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Stack
            spacing={0.5}
            sx={{
              minWidth: 0,
              flex: 1,
              display: { xs: 'none', md: 'flex' }
            }}
          >
            <Typography variant="overline" color="text.secondary">
              현재 작업 문맥
            </Typography>
            <Typography variant="subtitle2" noWrap>
              {currentWorkspace
                ? `${currentWorkspace.tenant.name} / ${ledger?.name ?? '기본 장부 미선정'}`
                : '연결된 사업장 없음'}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
            >
              {currentWorkspace ? (
                <>
                  <Chip
                    label={
                      membershipRole
                        ? (membershipRoleLabelMap[membershipRole] ??
                          membershipRole)
                        : '권한 미확인'
                    }
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {currentWorkspace.tenant.slug}
                  </Typography>
                  {ledger ? (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {ledger.baseCurrency} / {ledger.timezone}
                    </Typography>
                  ) : null}
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  연결된 문맥 없음
                </Typography>
              )}
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Stack
              spacing={0.5}
              sx={{
                minWidth: 0,
                display: { xs: 'flex', md: 'none' },
                textAlign: 'right'
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap>
                {currentWorkspace?.tenant.name ?? '연결된 사업장 없음'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {ledger?.name ?? '기본 장부 미선정'}
              </Typography>
            </Stack>

            <Button
              size="small"
              variant="outlined"
              onClick={(event) => setContextAnchorEl(event.currentTarget)}
            >
              문맥
            </Button>

            <Tooltip
              title={
                activeContext ? '도메인 가이드 열기' : '아직 문맥 정보가 없습니다'
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
        </Toolbar>
      </AppBar>

      <Popover
        open={contextPopoverOpen}
        anchorEl={contextAnchorEl}
        onClose={handleContextClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 360, maxWidth: 'calc(100vw - 32px)', p: 2 }}>
          <Stack spacing={1.5}>
            <div>
              <Typography variant="subtitle2">현재 작업 문맥</Typography>
            </div>

            <Divider flexItem />

            {currentWorkspace ? (
              <>
                <Stack spacing={1}>
                  <ContextDetailRow
                    label="사업장"
                    value={currentWorkspace.tenant.name}
                  />
                  <ContextDetailRow
                    label="사업장 슬러그"
                    value={currentWorkspace.tenant.slug}
                  />
                  <ContextDetailRow
                    label="장부"
                    value={ledger?.name ?? '기본 장부 미선정'}
                  />
                  <ContextDetailRow
                    label="권한"
                    value={
                      membershipRole
                        ? (membershipRoleLabelMap[membershipRole] ??
                          membershipRole)
                        : '권한 미확인'
                    }
                  />
                  <ContextDetailRow
                    label="기준 통화 / 시간대"
                    value={
                      ledger
                        ? `${ledger.baseCurrency} / ${ledger.timezone}`
                        : '장부 정보 없음'
                    }
                  />
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    component={Link}
                    href="/periods"
                    variant="contained"
                    size="small"
                    onClick={handleContextClose}
                  >
                    운영 월
                  </Button>
                  <Button
                    component={Link}
                    href="/reference-data"
                    variant="outlined"
                    size="small"
                    onClick={handleContextClose}
                  >
                    기준 데이터
                  </Button>
                  <Button
                    component={Link}
                    href="/settings"
                    variant="text"
                    size="small"
                    onClick={handleContextClose}
                  >
                    설정
                  </Button>
                </Stack>
              </>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  현재 워크스페이스를 먼저 확인해 주세요.
                </Typography>
                <div>
                  <Button
                    component={Link}
                    href="/settings"
                    variant="contained"
                    size="small"
                    onClick={handleContextClose}
                  >
                    설정으로 이동
                  </Button>
                </div>
              </Stack>
            )}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

function ContextDetailRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={0.5}
      justifyContent="space-between"
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
