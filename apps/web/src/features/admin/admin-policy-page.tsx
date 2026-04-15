'use client';

import { useMemo } from 'react';
import { Alert, Chip, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AdminPolicySurfaceItem,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  getAdminPolicySummary,
  adminPolicyQueryKey
} from './admin.api';
import {
  readMembershipRoleLabel,
  readPolicyCtaLabel
} from './admin-labels';
import { AdminSectionNav } from './admin-section-nav';

const policyRoles: TenantMembershipRole[] = [
  'OWNER',
  'MANAGER',
  'EDITOR',
  'VIEWER'
];

type AdminPolicyRow = AdminPolicySurfaceItem & {
  id: string;
};

export function AdminPolicyPage() {
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadPolicy = role === 'OWNER' || role === 'MANAGER';
  const policyQuery = useQuery({
    queryKey: adminPolicyQueryKey,
    queryFn: getAdminPolicySummary,
    enabled: canReadPolicy
  });

  const rows: AdminPolicyRow[] = (policyQuery.data?.items ?? []).map((item) => ({
    ...item,
    id: item.key
  }));
  const currentRoleLabel = readMembershipRoleLabel(role);
  const visibleSurfaceCount =
    policyQuery.data?.items.filter((item) =>
      role ? item.allowedRoles.includes(role) : false
    ).length ?? 0;

  const columns = useMemo<GridColDef<AdminPolicyRow>[]>(
    () => [
      { field: 'sectionLabel', headerName: '영역', width: 130 },
      { field: 'surfaceLabel', headerName: '화면', minWidth: 180, flex: 1 },
      { field: 'href', headerName: '경로', minWidth: 170, flex: 1 },
      {
        field: 'allowedRoles',
        headerName: '허용 역할',
        minWidth: 240,
        flex: 1.2,
        valueGetter: (_value, row) =>
          row.allowedRoles.map((item) => readMembershipRoleLabel(item)).join(', ')
      },
      {
        field: 'ctaPolicy',
        headerName: '노출 상태',
        width: 120,
        valueFormatter: (value) => readPolicyCtaLabel(String(value))
      }
    ],
    []
  );

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="권한 정책 요약"
        description="DB에 저장된 메뉴 트리 기준으로 화면별 노출 상태와 역할별 접근 기준을 표 중심으로 확인합니다."
        badges={[
          {
            label: canReadPolicy ? '조회 가능' : '조회 권한 없음',
            color: canReadPolicy ? 'success' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '현재 역할',
            value: currentRoleLabel
          },
          {
            label: '정책 표면',
            value: `${rows.length}개`
          },
          {
            label: '현재 역할 기준 접근',
            value: `${visibleSurfaceCount}개`
          }
        ]}
      />

      <AdminSectionNav />

      {!canReadPolicy ? (
        <Alert severity="warning" variant="outlined">
          권한 정책 요약은 소유자 또는 관리자 권한에서만 열 수 있습니다. 현재
          권한은 {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      {policyQuery.error ? (
        <QueryErrorAlert
        title="권한 정책 요약을 불러오지 못했습니다."
        error={policyQuery.error}
      />
      ) : null}

      <DataTableCard
        title="운영 화면 권한 매트릭스"
        description={`총 ${policyQuery.data?.items.length ?? 0}개 화면/영역 기준`}
        toolbar={
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {policyRoles.map((candidate) => {
                const count =
                  policyQuery.data?.items.filter((item) =>
                    item.allowedRoles.includes(candidate)
                  ).length ?? 0;

                return (
                  <Chip
                    key={candidate}
                    label={`${readMembershipRoleLabel(candidate)} ${count}개`}
                    size="small"
                    variant="outlined"
                  />
                );
              })}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              표에서는 화면 경로, 허용 역할, 메뉴 노출 상태를 한 줄에서 함께 읽고,
              현재 역할로 실제 접근 가능한 범위를 위 칩에서 먼저 확인합니다.
            </Typography>
          </Stack>
        }
        rows={rows}
        columns={columns}
        height={560}
      />
    </Stack>
  );
}
