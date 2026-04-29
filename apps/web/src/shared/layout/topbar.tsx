'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  IconButton,
  Popover,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  authWorkspacesQueryKey,
  getAccessibleWorkspaces
} from '@/features/auth/auth.api';
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { useAccountAvatar } from '@/shared/auth/account-avatar';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { membershipRoleLabelMap } from '@/shared/auth/auth-labels';
import { useDomainHelpStore } from '../providers/domain-help-provider';
import { brandTokens } from '../theme/tokens';
import { sidebarWidth } from './sidebar-nav';

export function Topbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, switchWorkspace, user } = useAuthSession();
  const { activeContext, setDrawerOpen } = useDomainHelpStore();
  const currentWorkspace = user?.currentWorkspace ?? null;
  const isSystemAdmin = user?.isSystemAdmin === true;
  const isSupportModeEnabled =
    currentWorkspace?.supportContext?.enabled === true;
  const ledger = currentWorkspace?.ledger ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const [contextAnchorEl, setContextAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const [accountAnchorEl, setAccountAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const contextPopoverOpen = Boolean(contextAnchorEl);
  const accountPopoverOpen = Boolean(accountAnchorEl);
  const { avatarContent, avatarSx } = useAccountAvatar(user?.id, user?.name);
  const handleContextClose = React.useCallback(() => {
    setContextAnchorEl(null);
  }, []);
  const handleAccountClose = React.useCallback(() => {
    setAccountAnchorEl(null);
  }, []);
  const workspacesQuery = useQuery({
    queryKey: authWorkspacesQueryKey,
    queryFn: getAccessibleWorkspaces,
    enabled: Boolean(user) && !isSystemAdmin
  });
  const workspaceSwitchMutation = useMutation({
    mutationFn: (input: { tenantId: string; ledgerId?: string }) =>
      switchWorkspace(input.tenantId, input.ledgerId),
    onSuccess: () => {
      queryClient.clear();
      handleContextClose();
      router.refresh();
    }
  });
  const workspaceOptions = workspacesQuery.data?.items ?? [];

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: alpha(brandTokens.palette.primaryBright, 0.14),
          backgroundColor: brandTokens.palette.surface,
          boxShadow: '0 8px 22px rgba(6, 34, 111, 0.05)',
          ml: { lg: `${sidebarWidth}px` },
          width: { lg: `calc(100% - ${sidebarWidth}px)` }
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 60, md: 64 },
            gap: 1.5,
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Stack
            spacing={0.25}
            sx={{
              minWidth: 0,
              flex: 1
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              {isSystemAdmin ? '전체 관리자 범위' : '현재 사업장 / 장부'}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {currentWorkspace
                  ? `${currentWorkspace.tenant.name} / ${ledger?.name ?? '기본 장부 미선정'}`
                  : isSystemAdmin
                    ? '전체 사업장 / 사용자 관리'
                    : '연결된 사업장 없음'}
              </Typography>
              {isSystemAdmin && isSupportModeEnabled ? (
                <Chip
                  label="지원 모드"
                  color="warning"
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 22,
                    borderRadius: 999,
                    '& .MuiChip-label': {
                      px: 1,
                      fontWeight: 700
                    }
                  }}
                />
              ) : null}
            </Stack>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              size="small"
              variant="outlined"
              onClick={(event) => setContextAnchorEl(event.currentTarget)}
              sx={topbarButtonSx}
            >
              기준
            </Button>

            <Tooltip
              title={
                activeContext
                  ? '화면 도움말 열기'
                  : '아직 화면 도움말이 없습니다'
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!activeContext}
                  onClick={() => setDrawerOpen(true)}
                  color="primary"
                  sx={topbarIconButtonSx}
                >
                  <HelpOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{
                pl: 1,
                borderLeft: '1px solid',
                borderColor: alpha(brandTokens.palette.primaryBright, 0.12)
              }}
            >
              <ButtonBase
                onClick={(event) => setAccountAnchorEl(event.currentTarget)}
                sx={{
                  minWidth: 0,
                  maxWidth: { xs: 44, sm: 260 },
                  borderRadius: 999,
                  px: { xs: 0.25, sm: 0.75 },
                  py: 0.25,
                  transition:
                    'background-color 160ms ease, box-shadow 160ms ease',
                  '&:hover': {
                    backgroundColor: alpha(
                      brandTokens.palette.primaryBright,
                      0.07
                    )
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: brandTokens.shadow.focus
                  }
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: '0.875rem',
                      ...avatarSx
                    }}
                  >
                    {avatarContent}
                  </Avatar>
                  <Stack
                    spacing={0}
                    sx={{
                      minWidth: 0,
                      maxWidth: 220,
                      display: { xs: 'none', sm: 'flex' },
                      textAlign: 'left'
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {user?.name ?? '사업장 사용자'}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: { xs: 'none', md: 'block' } }}
                    >
                      {user?.email ?? '로그인되지 않음'}
                    </Typography>
                  </Stack>
                  <KeyboardArrowDownRoundedIcon
                    fontSize="small"
                    sx={{
                      color: 'text.secondary',
                      display: { xs: 'none', sm: 'block' }
                    }}
                  />
                </Stack>
              </ButtonBase>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Popover
        open={accountPopoverOpen}
        anchorEl={accountAnchorEl}
        onClose={handleAccountClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 340, maxWidth: 'calc(100vw - 32px)', p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar
                sx={{ width: 48, height: 48, fontSize: '1.25rem', ...avatarSx }}
              >
                {avatarContent}
              </Avatar>
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {user?.name ?? '사업장 사용자'}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {user?.email ?? '로그인되지 않음'}
                </Typography>
              </Stack>
            </Stack>

            <Divider flexItem />

            <Stack spacing={1}>
              <Button
                component={Link}
                href="/settings/account/profile"
                variant="contained"
                size="small"
                startIcon={<ManageAccountsRoundedIcon fontSize="small" />}
                onClick={handleAccountClose}
                sx={{ justifyContent: 'flex-start' }}
              >
                프로필 수정
              </Button>

              <Button
                component={Link}
                href="/settings/account/password"
                variant="outlined"
                size="small"
                startIcon={<LockRoundedIcon fontSize="small" />}
                onClick={handleAccountClose}
                sx={{ justifyContent: 'flex-start' }}
              >
                비밀번호 변경
              </Button>
              <Button
                component={Link}
                href="/settings/account/sessions"
                variant="outlined"
                size="small"
                startIcon={<VerifiedUserRoundedIcon fontSize="small" />}
                onClick={handleAccountClose}
                sx={{ justifyContent: 'flex-start' }}
              >
                세션 관리
              </Button>
              <Button
                component={Link}
                href="/settings/account/events"
                variant="text"
                size="small"
                startIcon={<SecurityRoundedIcon fontSize="small" />}
                onClick={handleAccountClose}
                sx={{ justifyContent: 'flex-start' }}
              >
                보안 이벤트
              </Button>
            </Stack>

            <Divider flexItem />

            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<LogoutRoundedIcon fontSize="small" />}
              onClick={() => {
                handleAccountClose();
                void logout();
                router.replace('/login' as Route);
              }}
              sx={{ justifyContent: 'flex-start' }}
            >
              로그아웃
            </Button>
          </Stack>
        </Box>
      </Popover>

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
              <Typography variant="subtitle2">현재 사업장 / 장부</Typography>
            </div>

            <Divider flexItem />

            {isSystemAdmin ? (
              <>
                <Stack spacing={1}>
                  <ContextDetailRow
                    label="지원 모드"
                    value={isSupportModeEnabled ? '사용 중' : '꺼짐'}
                  />
                  <ContextDetailRow label="관리 범위" value="전체 사업장" />
                  <ContextDetailRow label="권한" value="전체 관리자" />
                  <ContextDetailRow
                    label="계정"
                    value={user?.email ?? '로그인되지 않음'}
                  />
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    component={Link}
                    href="/admin/members"
                    variant="contained"
                    size="small"
                    onClick={handleContextClose}
                  >
                    전체 회원 관리
                  </Button>
                  <Button
                    component={Link}
                    href="/admin/logs"
                    variant="outlined"
                    size="small"
                    onClick={handleContextClose}
                  >
                    전체 로그
                  </Button>
                </Stack>
              </>
            ) : currentWorkspace ? (
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

                {workspaceOptions.length > 1 ? (
                  <>
                    <Divider flexItem />
                    <Stack spacing={0.75}>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography variant="caption" color="text.secondary">
                          접근 가능한 사업장
                        </Typography>
                        <SwapHorizRoundedIcon
                          fontSize="small"
                          sx={{ color: 'text.secondary' }}
                        />
                      </Stack>
                      {workspaceSwitchMutation.error ? (
                        <Alert severity="error" variant="outlined">
                          {readErrorUserMessage(
                            workspaceSwitchMutation.error,
                            '사업장 전환에 실패했습니다.'
                          )}
                        </Alert>
                      ) : null}
                      {workspaceOptions.map((workspace) => (
                        <ButtonBase
                          key={`${workspace.tenant.id}:${workspace.ledger?.id ?? 'default'}`}
                          disabled={
                            workspace.isCurrent ||
                            workspaceSwitchMutation.isPending
                          }
                          onClick={() =>
                            workspaceSwitchMutation.mutate({
                              tenantId: workspace.tenant.id,
                              ...(workspace.ledger?.id
                                ? { ledgerId: workspace.ledger.id }
                                : {})
                            })
                          }
                          sx={createWorkspaceSwitchItemSx(workspace.isCurrent)}
                        >
                          <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              sx={{ minWidth: 0 }}
                            >
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                noWrap
                              >
                                {workspace.tenant.name}
                              </Typography>
                              {workspace.isCurrent ? (
                                <Chip
                                  label="현재"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ height: 20, borderRadius: 999 }}
                                />
                              ) : null}
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                            >
                              {workspace.tenant.slug} /{' '}
                              {workspace.ledger?.name ?? '기본 장부 미선정'} /{' '}
                              {membershipRoleLabelMap[
                                workspace.membership.role
                              ] ?? workspace.membership.role}
                            </Typography>
                          </Stack>
                        </ButtonBase>
                      ))}
                    </Stack>
                  </>
                ) : null}

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
                  현재 사업장 연결 상태를 먼저 확인해 주세요.
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

function ContextDetailRow({ label, value }: { label: string; value: string }) {
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

const topbarButtonSx = {
  minHeight: 34,
  px: 1.25,
  borderRadius: 999,
  textTransform: 'none',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderColor: alpha(brandTokens.palette.primaryBright, 0.24),
  backgroundColor: alpha(brandTokens.palette.surface, 0.72)
} as const;

const topbarIconButtonSx = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid',
  borderColor: alpha(brandTokens.palette.primaryBright, 0.18),
  backgroundColor: alpha(brandTokens.palette.primaryBright, 0.08),
  color: brandTokens.palette.primaryBright
} as const;

function createWorkspaceSwitchItemSx(selected: boolean) {
  return {
    width: '100%',
    minHeight: 58,
    px: 1,
    py: 0.75,
    borderRadius: 2,
    border: '1px solid',
    borderColor: selected
      ? alpha(brandTokens.palette.primaryBright, 0.42)
      : brandTokens.palette.border,
    background: selected
      ? `linear-gradient(135deg, ${alpha(
          brandTokens.palette.primaryBright,
          0.1
        )}, ${alpha(brandTokens.palette.secondary, 0.16)})`
      : brandTokens.palette.surface,
    textAlign: 'left',
    justifyContent: 'flex-start',
    opacity: selected ? 1 : undefined,
    '&:hover': {
      backgroundColor: selected
        ? alpha(brandTokens.palette.secondary, 0.18)
        : alpha(brandTokens.palette.primaryBright, 0.06)
    },
    '&.Mui-disabled': {
      opacity: 1,
      color: 'inherit'
    }
  } as const;
}
