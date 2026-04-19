'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Stack,
  Typography,
  type ChipProps
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { AdminTenantItem, TenantStatus } from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  adminTenantsQueryKey,
  getAdminTenant,
  getAdminTenants,
  updateAdminTenantStatus
} from './admin.api';
import { readTenantStatusLabel } from './admin-labels';

const NEXT_STATUS_OPTIONS: TenantStatus[] = [
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
];

export function AdminTenantsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const canRead = user?.isSystemAdmin === true;
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const tenantsQuery = useQuery({
    queryKey: adminTenantsQueryKey,
    queryFn: getAdminTenants,
    enabled: canRead
  });
  const detailQuery = useQuery({
    queryKey: [...adminTenantsQueryKey, selectedTenantId],
    queryFn: () => getAdminTenant(String(selectedTenantId)),
    enabled: Boolean(selectedTenantId)
  });
  const statusMutation = useMutation({
    mutationFn: (input: { tenantId: string; status: TenantStatus }) =>
      updateAdminTenantStatus(input.tenantId, { status: input.status }),
    onSuccess: async () => {
      setFeedback('사업장 상태를 변경했습니다.');
      await queryClient.invalidateQueries({ queryKey: adminTenantsQueryKey });
    }
  });

  useDomainHelp({
    title: '사업장 관리 가이드',
    description:
      '사업장 관리는 전체 관리자가 사업장 상태, 기본 장부, 멤버 구성을 확인하고 운영 상태를 최소 범위로 조정하는 화면입니다.',
    primaryEntity: '사업장',
    relatedEntities: ['장부', '멤버십', '감사 로그'],
    truthSource:
      '사업장 접근 가능 여부는 사업장 상태와 기본 장부 존재 여부를 함께 기준으로 봅니다.',
    supplementarySections: [
      {
        title: '확인 기준',
        items: [
          '기본 장부가 없는 사업장은 일반 운영 화면 진입 전에 장부 상태를 먼저 확인합니다.',
          '소유자가 없는 사업장은 멤버 관리에서 활성 소유자를 복구합니다.',
          '중지 또는 보관 상태는 운영 차단 목적이므로 변경 전 감사 로그를 확인합니다.'
        ]
      },
      {
        title: '후속 안내',
        links: [
          {
            title: '사업장 전환 / 지원 모드',
            href: '/admin/support-context',
            description:
              '선택한 사업장을 전체 관리자 지원 문맥으로 열어 운영 화면을 확인합니다.',
            actionLabel: '지원 모드 열기'
          }
        ]
      }
    ]
  });

  const rows = tenantsQuery.data ?? [];
  const summary = {
    total: rows.length,
    active: rows.filter((item) => item.status === 'ACTIVE').length,
    suspended: rows.filter((item) => item.status === 'SUSPENDED').length,
    missingLedger: rows.filter((item) => !item.defaultLedgerId).length
  };

  const columns = useMemo<GridColDef<AdminTenantItem>[]>(
    () => [
      { field: 'name', headerName: '사업장', flex: 1.2, minWidth: 180 },
      { field: 'slug', headerName: '슬러그', flex: 1, minWidth: 160 },
      {
        field: 'status',
        headerName: '상태',
        width: 110,
        renderCell: (params) => (
          <Chip
            label={readTenantStatusLabel(params.row.status)}
            color={readTenantStatusColor(params.row.status)}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, fontWeight: 700 }}
          />
        )
      },
      {
        field: 'defaultLedgerName',
        headerName: '기본 장부',
        flex: 1,
        minWidth: 160,
        valueFormatter: (value) => String(value || '-')
      },
      { field: 'activeMemberCount', headerName: '활성 멤버', width: 110 },
      { field: 'ownerCount', headerName: '소유자', width: 90 },
      {
        field: 'detail',
        headerName: '상세',
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            onClick={() => setSelectedTenantId(params.row.id)}
          >
            보기
          </Button>
        )
      }
    ],
    []
  );

  const selectedTenant = detailQuery.data ?? null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전체 관리자"
        title="사업장 관리"
        badges={[
          {
            label: canRead ? '전체 관리자 전용' : '조회 권한 없음',
            color: canRead ? 'success' : 'warning'
          },
          { label: `사업장 ${summary.total}곳` },
          { label: `활성 ${summary.active}곳` },
          { label: `기본 장부 누락 ${summary.missingLedger}곳` }
        ]}
      />
      {!canRead ? (
        <Alert severity="warning" variant="outlined">
          사업장 관리는 전체 관리자만 사용할 수 있습니다.
        </Alert>
      ) : null}
      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}
      {tenantsQuery.error ? (
        <QueryErrorAlert
          title="사업장 목록을 불러오지 못했습니다."
          error={tenantsQuery.error}
        />
      ) : null}
      <DataTableCard
        title="사업장 목록"
        description={`활성 ${summary.active}곳 · 중지 ${summary.suspended}곳`}
        rows={rows}
        columns={columns}
        height={560}
      />

      <FormDrawer
        open={Boolean(selectedTenantId)}
        onClose={() => setSelectedTenantId(null)}
        title="사업장 상세"
        description={selectedTenant?.name}
      >
        {selectedTenant ? (
          <Stack spacing={2}>
            <Detail label="슬러그" value={selectedTenant.slug} />
            <Detail
              label="상태"
              value={readTenantStatusLabel(selectedTenant.status)}
            />
            <Detail
              label="기본 장부"
              value={selectedTenant.defaultLedgerName ?? '-'}
            />
            <Detail
              label="멤버"
              value={`${selectedTenant.activeMemberCount}명 활성 / 전체 ${selectedTenant.memberCount}명`}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {NEXT_STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={
                    selectedTenant.status === status ? 'contained' : 'outlined'
                  }
                  disabled={
                    selectedTenant.status === status ||
                    statusMutation.isPending
                  }
                  onClick={() =>
                    statusMutation.mutate({
                      tenantId: selectedTenant.id,
                      status
                    })
                  }
                >
                  {readTenantStatusLabel(status)}
                </Button>
              ))}
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">장부</Typography>
              {selectedTenant.ledgers.map((ledger) => (
                <Typography key={ledger.id} variant="body2">
                  {ledger.name} / {ledger.baseCurrency} / {ledger.timezone} /{' '}
                  {ledger.status}
                </Typography>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            상세 정보를 불러오는 중입니다.
          </Typography>
        )}
      </FormDrawer>
    </Stack>
  );
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

function readTenantStatusColor(status: TenantStatus): ChipProps['color'] {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIAL':
      return 'info';
    case 'SUSPENDED':
      return 'warning';
    case 'ARCHIVED':
      return 'default';
  }
}
