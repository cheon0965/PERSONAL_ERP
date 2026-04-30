'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
  type ChipProps
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { AdminUserItem } from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { ResponsiveFilterPanel } from '@/shared/ui/responsive-filter-panel';
import {
  adminUsersQueryKey,
  getAdminUser,
  getAdminUsers,
  revokeAdminUserSessions,
  updateAdminUserEmailVerification,
  updateAdminUserStatus,
  updateAdminUserSystemAdmin
} from './admin.api';
import { readUserStatusLabel } from './admin-labels';

type AdminUserFilters = {
  keyword: string;
  status: string;
  systemAdmin: string;
  emailVerified: string;
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const canRead = user?.isSystemAdmin === true;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);
  const [detailFeedback, setDetailFeedback] =
    useState<FeedbackAlertValue>(null);
  const [tableFilters, setTableFilters] = useState<AdminUserFilters>({
    keyword: '',
    status: '',
    systemAdmin: '',
    emailVerified: ''
  });

  const usersQuery = useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: getAdminUsers,
    enabled: canRead
  });
  const detailQuery = useQuery({
    queryKey: [...adminUsersQueryKey, selectedUserId],
    queryFn: () => getAdminUser(String(selectedUserId)),
    enabled: Boolean(selectedUserId)
  });

  const invalidateUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
  };

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: AdminUserItem['status'] }) =>
      updateAdminUserStatus(input.userId, {
        status: input.status,
        reason:
          input.status === 'ACTIVE' ? undefined : '전체 관리자 수동 상태 변경'
      }),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '사용자 상태를 변경했습니다.'
      });
      setDetailFeedback(null);
      await invalidateUsers();
    },
    onError: (error) => {
      setDetailFeedback(
        buildErrorFeedback(error, '사용자 상태를 변경하지 못했습니다.')
      );
    }
  });
  const revokeSessionsMutation = useMutation({
    mutationFn: revokeAdminUserSessions,
    onSuccess: async (result) => {
      setFeedback({
        severity: 'success',
        message: `세션 ${result.revokedCount}개를 만료했습니다.`
      });
      setDetailFeedback(null);
      await invalidateUsers();
    },
    onError: (error) => {
      setDetailFeedback(
        buildErrorFeedback(error, '사용자 세션을 만료하지 못했습니다.')
      );
    }
  });
  const systemAdminMutation = useMutation({
    mutationFn: (input: { userId: string; isSystemAdmin: boolean }) =>
      updateAdminUserSystemAdmin(input.userId, {
        isSystemAdmin: input.isSystemAdmin
    }),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '전체 관리자 권한을 변경했습니다.'
      });
      setDetailFeedback(null);
      await invalidateUsers();
    },
    onError: (error) => {
      setDetailFeedback(
        buildErrorFeedback(error, '전체 관리자 권한을 변경하지 못했습니다.')
      );
    }
  });
  const emailVerificationMutation = useMutation({
    mutationFn: (userId: string) =>
      updateAdminUserEmailVerification(userId, { emailVerified: true }),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '이메일 인증 상태를 확인 처리했습니다.'
      });
      setDetailFeedback(null);
      await invalidateUsers();
    },
    onError: (error) => {
      setDetailFeedback(
        buildErrorFeedback(error, '이메일 인증 상태를 변경하지 못했습니다.')
      );
    }
  });

  useDomainHelp({
    title: '전체 사용자 관리 가이드',
    description:
      '전체 사용자 관리는 계정 잠금, 세션 만료, 이메일 인증 보정, 전체 관리자 권한을 최소 범위로 조정하는 화면입니다.',
    primaryEntity: '사용자 계정',
    relatedEntities: ['멤버십', '세션', '보안 위협 로그'],
    truthSource:
      '로그인 가능 여부는 사용자 상태, 이메일 인증, 활성 세션 상태를 함께 기준으로 판단합니다.',
    supplementarySections: [
      {
        title: '확인 기준',
        items: [
          '상단 요약에서 잠금 사용자, 전체 관리자, 활성 세션 규모를 먼저 확인합니다.',
          '검색과 상태 필터로 조치 대상 계정을 좁힌 뒤 이메일과 사용자 ID를 다시 확인합니다.',
          '잠금 또는 비활성 계정은 로그인할 수 없으므로 상태 변경 전 대상 사용자를 확인합니다.',
          '활성 세션이 많은 사용자는 세션 만료 후 재로그인을 유도합니다.',
          '전체 관리자 권한 변경은 마지막 전체 관리자 보호 규칙을 반드시 통과해야 합니다.'
        ]
      },
      {
        title: '후속 안내',
        links: [
          {
            title: '보안 위협 로그',
            href: '/admin/security-threats',
            description:
              '사용자 ID 기준으로 최근 보안 위협 이벤트를 함께 확인합니다.',
            actionLabel: '보안 위협 로그 열기'
          }
        ]
      }
    ]
  });

  const rows = usersQuery.data ?? [];
  const filteredRows = useMemo(
    () => filterAdminUsers(rows, tableFilters),
    [rows, tableFilters]
  );
  const summary = {
    total: rows.length,
    locked: rows.filter((item) => item.status !== 'ACTIVE').length,
    admins: rows.filter((item) => item.isSystemAdmin).length,
    activeSessions: rows.reduce((sum, item) => sum + item.activeSessionCount, 0)
  };

  const columns = useMemo<GridColDef<AdminUserItem>[]>(
    () => [
      { field: 'email', headerName: '이메일', flex: 1.4, minWidth: 220 },
      { field: 'name', headerName: '이름', flex: 1, minWidth: 140 },
      {
        field: 'status',
        headerName: '상태',
        width: 110,
        renderCell: (params) => (
          <Chip
            label={readUserStatusLabel(params.row.status)}
            color={readUserStatusColor(params.row.status)}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, fontWeight: 700 }}
          />
        )
      },
      {
        field: 'isSystemAdmin',
        headerName: '전체 관리자',
        width: 120,
        valueFormatter: (value) => (value ? '예' : '아니오')
      },
      {
        field: 'emailVerified',
        headerName: '이메일 인증',
        width: 120,
        valueFormatter: (value) => (value ? '완료' : '미완료')
      },
      {
        field: 'activeSessionCount',
        headerName: '활성 세션',
        width: 110
      },
      {
        field: 'membershipCount',
        headerName: '멤버십',
        width: 100
      },
      {
        field: 'detail',
        headerName: '상세',
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            onClick={() => {
              setFeedback(null);
              setDetailFeedback(null);
              setSelectedUserId(params.row.id);
            }}
          >
            보기
          </Button>
        )
      }
    ],
    []
  );

  const selectedUser = detailQuery.data ?? null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전체 관리자"
        title="전체 사용자 관리"
        badges={[
          {
            label: canRead ? '전체 관리자 전용' : '조회 권한 없음',
            color: canRead ? 'success' : 'warning'
          },
          { label: `사용자 ${summary.total}명` },
          { label: `잠금/비활성 ${summary.locked}명` },
          { label: `활성 세션 ${summary.activeSessions}개` }
        ]}
      />
      {!canRead ? (
        <Alert severity="warning" variant="outlined">
          전체 사용자 관리는 전체 관리자만 사용할 수 있습니다.
        </Alert>
      ) : null}
      <FeedbackAlert feedback={feedback} />
      {usersQuery.error ? (
        <QueryErrorAlert
          title="전체 사용자 목록을 불러오지 못했습니다."
          error={usersQuery.error}
        />
      ) : null}
      <DataTableCard
        title="사용자 목록"
        description={`전체 관리자 ${summary.admins}명 · 잠금/비활성 ${summary.locked}명`}
        toolbar={
          <AdminUsersTableToolbar
            filters={tableFilters}
            onFiltersChange={setTableFilters}
          />
        }
        rows={filteredRows}
        columns={columns}
        height={560}
      />

      <FormDrawer
        open={Boolean(selectedUserId)}
        onClose={() => {
          setSelectedUserId(null);
          setDetailFeedback(null);
        }}
        title="사용자 상세"
        description={selectedUser?.email}
      >
        {selectedUser ? (
          <Stack spacing={2}>
            <FeedbackAlert feedback={detailFeedback} />
            <Detail label="이름" value={selectedUser.name} />
            <Detail
              label="상태"
              value={readUserStatusLabel(selectedUser.status)}
            />
            <Detail
              label="이메일 인증"
              value={selectedUser.emailVerified ? '완료' : '미완료'}
            />
            <Detail
              label="세션"
              value={`${selectedUser.activeSessionCount}개 활성 / 전체 ${selectedUser.sessionCount}개`}
            />
            <Detail
              label="멤버십"
              value={`${selectedUser.activeMembershipCount}개 활성 / 전체 ${selectedUser.membershipCount}개`}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                color={selectedUser.status === 'ACTIVE' ? 'warning' : 'success'}
                disabled={statusMutation.isPending}
                onClick={() => {
                  setFeedback(null);
                  setDetailFeedback(null);
                  statusMutation.mutate({
                    userId: selectedUser.id,
                    status:
                      selectedUser.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'
                  });
                }}
              >
                {selectedUser.status === 'ACTIVE' ? '계정 잠금' : '잠금 해제'}
              </Button>
              <Button
                variant="outlined"
                disabled={revokeSessionsMutation.isPending}
                onClick={() => {
                  setFeedback(null);
                  setDetailFeedback(null);
                  revokeSessionsMutation.mutate(selectedUser.id);
                }}
              >
                모든 세션 만료
              </Button>
              {!selectedUser.emailVerified ? (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFeedback(null);
                    setDetailFeedback(null);
                    emailVerificationMutation.mutate(selectedUser.id);
                  }}
                >
                  이메일 인증 처리
                </Button>
              ) : null}
              <Button
                variant="outlined"
                color={selectedUser.isSystemAdmin ? 'warning' : 'primary'}
                disabled={systemAdminMutation.isPending}
                onClick={() => {
                  setFeedback(null);
                  setDetailFeedback(null);
                  systemAdminMutation.mutate({
                    userId: selectedUser.id,
                    isSystemAdmin: !selectedUser.isSystemAdmin
                  });
                }}
              >
                {selectedUser.isSystemAdmin
                  ? '전체 관리자 회수'
                  : '전체 관리자 부여'}
              </Button>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">멤버십</Typography>
              {selectedUser.memberships.map((membership) => (
                <Typography key={membership.id} variant="body2">
                  {membership.tenantName} / {membership.role} /{' '}
                  {membership.status}
                </Typography>
              ))}
            </Stack>
          </Stack>
        ) : detailQuery.error ? (
          <QueryErrorAlert
            title="사용자 상세를 불러오지 못했습니다."
            error={detailQuery.error}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            상세 정보를 불러오는 중입니다.
          </Typography>
        )}
      </FormDrawer>
    </Stack>
  );
}

function AdminUsersTableToolbar({
  filters,
  onFiltersChange
}: {
  filters: AdminUserFilters;
  onFiltersChange: (filters: AdminUserFilters) => void;
}) {
  const hasActiveFilter = Object.values(filters).some((value) => value !== '');
  const activeFilterLabels = [
    filters.keyword.trim() ? `검색: ${filters.keyword.trim()}` : null,
    filters.status ? `상태: ${readUserStatusLabel(filters.status)}` : null,
    filters.systemAdmin
      ? `전체 관리자: ${filters.systemAdmin === 'YES' ? '예' : '아니오'}`
      : null,
    filters.emailVerified
      ? `이메일 인증: ${filters.emailVerified === 'YES' ? '완료' : '미완료'}`
      : null
  ].filter((label): label is string => Boolean(label));
  const clearFilters = () =>
    onFiltersChange({
      keyword: '',
      status: '',
      systemAdmin: '',
      emailVerified: ''
    });

  return (
    <ResponsiveFilterPanel
      title="사용자 조회조건"
      activeFilterCount={activeFilterLabels.length}
      activeFilterLabels={activeFilterLabels}
      onClear={clearFilters}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <TextField
          label="검색어"
          size="small"
          value={filters.keyword}
          onChange={(event) =>
            onFiltersChange({ ...filters, keyword: event.target.value })
          }
          placeholder="이메일, 이름"
          sx={{ minWidth: { md: 240 }, flex: 1 }}
        />
        <TextField
          select
          label="상태"
          size="small"
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ ...filters, status: event.target.value })
          }
          sx={{ minWidth: { md: 140 } }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="ACTIVE">활성</MenuItem>
          <MenuItem value="LOCKED">잠금</MenuItem>
          <MenuItem value="DISABLED">비활성</MenuItem>
        </TextField>
        <TextField
          select
          label="전체 관리자"
          size="small"
          value={filters.systemAdmin}
          onChange={(event) =>
            onFiltersChange({ ...filters, systemAdmin: event.target.value })
          }
          sx={{ minWidth: { md: 140 } }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="YES">예</MenuItem>
          <MenuItem value="NO">아니오</MenuItem>
        </TextField>
        <TextField
          select
          label="이메일 인증"
          size="small"
          value={filters.emailVerified}
          onChange={(event) =>
            onFiltersChange({ ...filters, emailVerified: event.target.value })
          }
          sx={{ minWidth: { md: 140 } }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="YES">완료</MenuItem>
          <MenuItem value="NO">미완료</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          disabled={!hasActiveFilter}
          sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
          onClick={clearFilters}
        >
          초기화
        </Button>
      </Stack>
    </ResponsiveFilterPanel>
  );
}

function filterAdminUsers(users: AdminUserItem[], filters: AdminUserFilters) {
  const keyword = normalizeFilterText(filters.keyword);

  return users.filter((user) => {
    if (filters.status && user.status !== filters.status) {
      return false;
    }

    if (filters.systemAdmin === 'YES' && !user.isSystemAdmin) {
      return false;
    }

    if (filters.systemAdmin === 'NO' && user.isSystemAdmin) {
      return false;
    }

    if (filters.emailVerified === 'YES' && !user.emailVerified) {
      return false;
    }

    if (filters.emailVerified === 'NO' && user.emailVerified) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return normalizeFilterText([user.email, user.name].join(' ')).includes(
      keyword
    );
  });
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function readUserStatusColor(
  status: AdminUserItem['status']
): ChipProps['color'] {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'LOCKED':
      return 'warning';
    case 'DISABLED':
      return 'default';
  }
}
