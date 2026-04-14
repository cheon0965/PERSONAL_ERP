'use client';

import { useMemo } from 'react';
import { Alert, Grid, Stack, Typography } from '@mui/material';
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
import { SectionCard } from '@/shared/ui/section-card';
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
        headerName: 'CTA 기준',
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
        description="설정, 관리자, 운영 핵심 화면의 역할별 접근 기준과 CTA 노출 정책을 정리합니다."
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

      <Grid container spacing={appLayout.sectionGap}>
        {policyRoles.map((candidate) => {
          const count =
            policyQuery.data?.items.filter((item) =>
              item.allowedRoles.includes(candidate)
            ).length ?? 0;

          return (
            <Grid key={candidate} size={{ xs: 12, sm: 6, lg: 3 }}>
              <SectionCard
                title={readMembershipRoleLabel(candidate)}
                description="현재 정책 기준에서 접근 가능한 화면 수"
              >
                <Typography variant="h4">{count}</Typography>
              </SectionCard>
            </Grid>
          );
        })}
      </Grid>

      <DataTableCard
        title="운영 화면 권한 매트릭스"
        description={`총 ${policyQuery.data?.items.length ?? 0}개 화면/영역 기준`}
        rows={rows}
        columns={columns}
        height={560}
      />
    </Stack>
  );
}
