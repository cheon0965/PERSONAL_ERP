'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AdminAuditEventItem,
  AdminAuditEventQuery
} from '@personal-erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  adminAuditEventsQueryKey,
  getAdminAuditEvents,
  getAdminAuditEvent
} from './admin.api';
import { readAuditResultLabel, readMembershipRoleLabel } from './admin-labels';
import { AdminSectionNav } from './admin-section-nav';

export function AdminLogsPage() {
  const searchParams = useSearchParams();
  const initialRequestId = searchParams?.get('requestId') ?? '';
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadLogs = role === 'OWNER';
  const [filters, setFilters] = useState<AdminAuditEventQuery>({
    limit: 50,
    offset: 0,
    requestId: initialRequestId || undefined
  });
  const [draftEventCategory, setDraftEventCategory] = useState('');
  const [draftAction, setDraftAction] = useState('');
  const [draftActorMembershipId, setDraftActorMembershipId] = useState('');
  const [draftResourceType, setDraftResourceType] = useState('');
  const [draftResourceId, setDraftResourceId] = useState('');
  const [draftRequestId, setDraftRequestId] = useState('');
  const [draftResult, setDraftResult] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const activeFilterCount = [
    filters.eventCategory,
    filters.action,
    filters.actorMembershipId,
    filters.resourceType,
    filters.resourceId,
    filters.requestId,
    filters.result
  ].filter(Boolean).length;

  const auditEventsQuery = useQuery({
    queryKey: [...adminAuditEventsQueryKey, filters],
    queryFn: () => getAdminAuditEvents(filters),
    enabled: canReadLogs
  });
  const detailQuery = useQuery({
    queryKey: [...adminAuditEventsQueryKey, selectedEventId],
    queryFn: () => getAdminAuditEvent(String(selectedEventId)),
    enabled: Boolean(selectedEventId)
  });

  useDomainHelp({
    title: '감사 로그 가이드',
    description:
      '감사 로그는 관리자 작업과 보안 관련 이벤트를 requestId 기준으로 추적하는 화면입니다.',
    primaryEntity: 'WorkspaceAuditEvent',
    relatedEntities: ['TenantMembership', 'User'],
    truthSource:
      '감사 로그는 서버에서 기록한 이벤트를 그대로 읽는 추적 기록입니다.',
    supplementarySections: [
      {
        title: '자주 확인하는 기준',
        items: [
          'requestId',
          'event category',
          'action',
          'actor membership',
          'resource type / resource id'
        ]
      }
    ]
  });

  useEffect(() => {
    if (!initialRequestId) {
      return;
    }

    setDraftRequestId(initialRequestId);
    setFilters({
      limit: 50,
      offset: 0,
      requestId: initialRequestId
    });
  }, [initialRequestId]);

  function applyFilters() {
    setFilters({
      limit: 50,
      offset: 0,
      eventCategory: draftEventCategory.trim() || undefined,
      action: draftAction.trim() || undefined,
      actorMembershipId: draftActorMembershipId.trim() || undefined,
      resourceType: draftResourceType.trim() || undefined,
      resourceId: draftResourceId.trim() || undefined,
      requestId: draftRequestId.trim() || undefined,
      result: draftResult
        ? (draftResult as AdminAuditEventQuery['result'])
        : undefined
    });
  }

  function clearFilters() {
    setDraftEventCategory('');
    setDraftAction('');
    setDraftActorMembershipId('');
    setDraftResourceType('');
    setDraftResourceId('');
    setDraftRequestId('');
    setDraftResult('');
    setFilters({
      limit: 50,
      offset: 0
    });
  }

  const columns = useMemo<GridColDef<AdminAuditEventItem>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: '발생 시각',
        minWidth: 180,
        valueFormatter: (value) => formatDateTime(String(value))
      },
      {
        field: 'result',
        headerName: '결과',
        width: 90,
        valueFormatter: (value) => readAuditResultLabel(String(value))
      },
      { field: 'eventName', headerName: '이벤트', flex: 1, minWidth: 220 },
      { field: 'eventCategory', headerName: '분류', width: 130 },
      { field: 'action', headerName: '액션', flex: 1, minWidth: 200 },
      { field: 'resourceType', headerName: '리소스', width: 140 },
      {
        field: 'actorRole',
        headerName: '역할',
        width: 100,
        valueFormatter: (value) => readMembershipRoleLabel(String(value))
      },
      { field: 'requestId', headerName: 'Request ID', flex: 1, minWidth: 220 },
      {
        field: 'detail',
        headerName: '상세',
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            onClick={() => setSelectedEventId(params.row.id)}
          >
            보기
          </Button>
        )
      }
    ],
    []
  );

  const selectedEvent = detailQuery.data ?? null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="로그관리"
        description="현재 사업장 문맥의 감사 이벤트를 조회합니다."
        badges={[
          {
            label: canReadLogs ? '소유자 전용 조회' : '조회 권한 없음',
            color: canReadLogs ? 'success' : 'warning'
          },
          ...(filters.requestId
            ? [{ label: `Request ID ${filters.requestId}` }]
            : [])
        ]}
        metadata={[
          {
            label: '표시 로그',
            value: `${auditEventsQuery.data?.items.length ?? 0}건`
          },
          {
            label: '전체 로그',
            value: `${auditEventsQuery.data?.total ?? 0}건`
          },
          {
            label: '적용 필터',
            value: `${activeFilterCount}개`
          }
        ]}
      />

      <AdminSectionNav />

      {!canReadLogs ? (
        <Alert severity="warning" variant="outlined">
          로그관리는 소유자 권한에서 사용할 수 있습니다. 현재 권한은{' '}
          {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      {auditEventsQuery.error ? (
        <QueryErrorAlert
          title="감사 로그를 불러오지 못했습니다."
          error={auditEventsQuery.error}
        />
      ) : null}

      <DataTableCard
        title="감사 로그"
        description={`총 ${auditEventsQuery.data?.total ?? 0}건`}
        toolbar={
          <Stack
            spacing={2}
            sx={{
              p: appLayout.cardPadding,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              분류, 액션, 리소스, Request ID 기준으로 로그를 좁혀 본 뒤 표에서
              바로 상세를 확인합니다.
            </Typography>
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="분류"
                  value={draftEventCategory}
                  onChange={(event) =>
                    setDraftEventCategory(event.target.value)
                  }
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="액션"
                  value={draftAction}
                  onChange={(event) => setDraftAction(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="Actor Membership"
                  value={draftActorMembershipId}
                  onChange={(event) =>
                    setDraftActorMembershipId(event.target.value)
                  }
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="리소스 유형"
                  value={draftResourceType}
                  onChange={(event) => setDraftResourceType(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="리소스 ID"
                  value={draftResourceId}
                  onChange={(event) => setDraftResourceId(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  label="Request ID"
                  value={draftRequestId}
                  onChange={(event) => setDraftRequestId(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="결과"
                  value={draftResult}
                  onChange={(event) => setDraftResult(event.target.value)}
                  size="small"
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="SUCCESS">성공</MenuItem>
                  <MenuItem value="DENIED">거부</MenuItem>
                  <MenuItem value="FAILED">실패</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    disabled={!canReadLogs}
                    onClick={applyFilters}
                  >
                    필터 적용
                  </Button>
                  {activeFilterCount > 0 ? (
                    <Button onClick={clearFilters}>초기화</Button>
                  ) : null}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        }
        rows={auditEventsQuery.data?.items ?? []}
        columns={columns}
        height={560}
      />

      <FormDrawer
        open={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        title="감사 로그 상세"
        description={selectedEvent?.eventName}
      >
        {selectedEvent ? (
          <Stack spacing={1.5}>
            <Detail
              label="결과"
              value={readAuditResultLabel(selectedEvent.result)}
            />
            <Detail label="분류" value={selectedEvent.eventCategory} />
            <Detail label="이벤트" value={selectedEvent.eventName} />
            <Detail label="액션" value={selectedEvent.action ?? '-'} />
            <Detail label="리소스" value={selectedEvent.resourceType ?? '-'} />
            <Detail label="리소스 ID" value={selectedEvent.resourceId ?? '-'} />
            <Detail label="Request ID" value={selectedEvent.requestId ?? '-'} />
            <Detail label="사유" value={selectedEvent.reason ?? '-'} />
            <Detail label="경로" value={selectedEvent.path ?? '-'} />
            <Detail
              label="Actor"
              value={`${selectedEvent.actorMembershipId ?? '-'} / ${readMembershipRoleLabel(selectedEvent.actorRole)}`}
            />
            <Detail
              label="Metadata"
              value={
                selectedEvent.metadata
                  ? JSON.stringify(selectedEvent.metadata)
                  : '-'
              }
            />
            {selectedEvent.requestId ? (
              <Button
                variant="outlined"
                onClick={() => {
                  setDraftRequestId(selectedEvent.requestId ?? '');
                  setFilters({
                    limit: 50,
                    offset: 0,
                    requestId: selectedEvent.requestId ?? undefined
                  });
                  setSelectedEventId(null);
                }}
              >
                같은 Request ID로 보기
              </Button>
            ) : null}
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().replace('T', ' ').slice(0, 19);
}
