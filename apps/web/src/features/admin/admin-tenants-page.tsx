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
import type { AdminTenantItem, TenantStatus } from '@personal-erp/contracts';
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
  adminTenantsQueryKey,
  getAdminTenant,
  getAdminTenants,
  updateAdminTenantStatus
} from './admin.api';
import { readTenantStatusLabel } from './admin-labels';

const NEXT_STATUS_OPTIONS: TenantStatus[] = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];

type AdminTenantFilters = {
  keyword: string;
  status: string;
  ledgerState: string;
};

export function AdminTenantsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const canRead = user?.isSystemAdmin === true;
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);
  const [detailFeedback, setDetailFeedback] =
    useState<FeedbackAlertValue>(null);
  const [tableFilters, setTableFilters] = useState<AdminTenantFilters>({
    keyword: '',
    status: '',
    ledgerState: ''
  });

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
      setFeedback({
        severity: 'success',
        message: '사업장 상태를 변경했습니다.'
      });
      setDetailFeedback(null);
      await queryClient.invalidateQueries({ queryKey: adminTenantsQueryKey });
    },
    onError: (error) => {
      setDetailFeedback(
        buildErrorFeedback(error, '사업장 상태를 변경하지 못했습니다.')
      );
    }
  });

  useDomainHelp({
    title: '사업장 관리 화면 도움말',
    description:
      '사업장 관리는 전체 관리자가 사업장 상태, 기본 장부, 멤버 구성을 확인하고 운영 상태를 최소 범위로 조정하는 화면입니다.',
    primaryEntity: '사업장',
    relatedEntities: ['장부', '멤버십', '감사 로그'],
    truthSource:
      '사업장 접근 가능 여부는 사업장 상태와 기본 장부 존재 여부를 함께 기준으로 봅니다.',
    supplementarySections: [
      {
        title: '먼저 확인할 기준',
        items: [
          '사업장 목록에서 상태, 기본 장부, 활성 멤버, 소유자 수를 먼저 확인합니다.',
          '상세를 열어 장부와 멤버 구성이 실제 운영 대상과 맞는지 확인합니다.',
          '기본 장부가 없는 사업장은 일반 운영 화면 진입 전에 장부 상태를 먼저 확인합니다.',
          '소유자가 없는 사업장은 멤버 관리에서 활성 소유자를 복구합니다.',
          '중지 또는 보관 상태는 운영 차단 목적이므로 변경 전 감사 로그를 확인합니다.'
        ]
      },
      {
        title: '다음 작업',
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
  const filteredRows = useMemo(
    () => filterAdminTenants(rows, tableFilters),
    [rows, tableFilters]
  );
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
            onClick={() => {
              setFeedback(null);
              setDetailFeedback(null);
              setSelectedTenantId(params.row.id);
            }}
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
      <FeedbackAlert feedback={feedback} />
      {tenantsQuery.error ? (
        <QueryErrorAlert
          title="사업장 목록을 불러오지 못했습니다."
          error={tenantsQuery.error}
        />
      ) : null}
      <DataTableCard
        title="사업장 목록"
        description={`활성 ${summary.active}곳 · 중지 ${summary.suspended}곳`}
        toolbar={
          <AdminTenantsTableToolbar
            filters={tableFilters}
            onFiltersChange={setTableFilters}
          />
        }
        rows={filteredRows}
        columns={columns}
        height={560}
      />

      <FormDrawer
        open={Boolean(selectedTenantId)}
        onClose={() => {
          setSelectedTenantId(null);
          setDetailFeedback(null);
        }}
        title="사업장 상세"
        description={selectedTenant?.name}
      >
        {selectedTenant ? (
          <Stack spacing={2}>
            <FeedbackAlert feedback={detailFeedback} />
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
                    selectedTenant.status === status || statusMutation.isPending
                  }
                  onClick={() => {
                    setFeedback(null);
                    setDetailFeedback(null);
                    statusMutation.mutate({
                      tenantId: selectedTenant.id,
                      status
                    });
                  }}
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
        ) : detailQuery.error ? (
          <QueryErrorAlert
            title="사업장 상세를 불러오지 못했습니다."
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

function AdminTenantsTableToolbar({
  filters,
  onFiltersChange
}: {
  filters: AdminTenantFilters;
  onFiltersChange: (filters: AdminTenantFilters) => void;
}) {
  const hasActiveFilter = Object.values(filters).some((value) => value !== '');
  const activeFilterLabels = [
    filters.keyword.trim() ? `검색: ${filters.keyword.trim()}` : null,
    filters.status ? `상태: ${readTenantStatusLabel(filters.status)}` : null,
    filters.ledgerState
      ? `기본 장부: ${filters.ledgerState === 'READY' ? '있음' : '누락'}`
      : null
  ].filter((label): label is string => Boolean(label));
  const clearFilters = () =>
    onFiltersChange({
      keyword: '',
      status: '',
      ledgerState: ''
    });

  return (
    <ResponsiveFilterPanel
      title="사업장 조회조건"
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
          placeholder="사업장, 슬러그, 장부"
          sx={{ minWidth: { md: 260 }, flex: 1 }}
        />
        <TextField
          select
          label="상태"
          size="small"
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ ...filters, status: event.target.value })
          }
          sx={{ minWidth: { md: 150 } }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="ACTIVE">활성</MenuItem>
          <MenuItem value="TRIAL">체험</MenuItem>
          <MenuItem value="SUSPENDED">중지</MenuItem>
          <MenuItem value="ARCHIVED">보관</MenuItem>
        </TextField>
        <TextField
          select
          label="기본 장부"
          size="small"
          value={filters.ledgerState}
          onChange={(event) =>
            onFiltersChange({ ...filters, ledgerState: event.target.value })
          }
          sx={{ minWidth: { md: 150 } }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="READY">있음</MenuItem>
          <MenuItem value="MISSING">누락</MenuItem>
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

function filterAdminTenants(
  tenants: AdminTenantItem[],
  filters: AdminTenantFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return tenants.filter((tenant) => {
    if (filters.status && tenant.status !== filters.status) {
      return false;
    }

    if (filters.ledgerState === 'READY' && !tenant.defaultLedgerId) {
      return false;
    }

    if (filters.ledgerState === 'MISSING' && tenant.defaultLedgerId) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return normalizeFilterText(
      [tenant.name, tenant.slug, tenant.defaultLedgerName]
        .filter(Boolean)
        .join(' ')
    ).includes(keyword);
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
