'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  type ChipProps
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AdminSecurityThreatCategory,
  AdminSecurityThreatEventItem,
  AdminSecurityThreatEventQuery,
  AdminSecurityThreatSeverity
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
  adminSecurityThreatEventsQueryKey,
  getAdminSecurityThreatEvents
} from './admin.api';
import {
  readSecurityThreatCategoryLabel,
  readSecurityThreatSeverityLabel
} from './admin-labels';

const SECURITY_THREAT_SEVERITIES: AdminSecurityThreatSeverity[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
];

const SECURITY_THREAT_CATEGORIES: AdminSecurityThreatCategory[] = [
  'AUTHENTICATION',
  'REGISTRATION',
  'SESSION',
  'EMAIL_VERIFICATION',
  'ACCESS_CONTROL',
  'BROWSER_ORIGIN',
  'EMAIL_DELIVERY',
  'SYSTEM'
];

export function AdminSecurityThreatsPage() {
  const searchParams = useSearchParams();
  const initialRequestId = searchParams?.get('requestId') ?? '';
  const { user } = useAuthSession();
  const canReadThreatLogs = user?.isSystemAdmin === true;
  const [filters, setFilters] = useState<AdminSecurityThreatEventQuery>({
    limit: 50,
    offset: 0,
    requestId: initialRequestId || undefined
  });
  const [draftSeverity, setDraftSeverity] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftEventName, setDraftEventName] = useState('');
  const [draftRequestId, setDraftRequestId] = useState('');
  const [draftClientIpHash, setDraftClientIpHash] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const [selectedEvent, setSelectedEvent] =
    useState<AdminSecurityThreatEventItem | null>(null);
  const activeFilterCount = [
    filters.severity,
    filters.eventCategory,
    filters.eventName,
    filters.requestId,
    filters.clientIpHash,
    filters.userId
  ].filter(Boolean).length;

  const threatEventsQuery = useQuery({
    queryKey: [...adminSecurityThreatEventsQueryKey, filters],
    queryFn: () => getAdminSecurityThreatEvents(filters),
    enabled: canReadThreatLogs
  });

  useDomainHelp({
    title: '보안 위협 로그 화면 도움말',
    description:
      '보안 위협 로그는 로그인 실패, 가입 제한, 세션 재사용 감지, 출처 차단, 권한 거부처럼 보안상 별도로 확인해야 하는 이벤트만 모아보는 전체 관리자 화면입니다.',
    primaryEntity: '보안 위협 이벤트',
    relatedEntities: ['감사 로그', '사용자', '세션', '요청번호'],
    truthSource:
      '원본 이벤트는 서버 보안 로거가 기록하며, IP는 원문이 아닌 해시로 저장합니다.',
    supplementarySections: [
      {
        title: '먼저 확인할 기준',
        items: [
          '긴급 또는 높음 등급 이벤트를 먼저 확인해 반복 공격이나 세션 탈취 의심 흐름을 빠르게 분리합니다.',
          '요청번호가 있는 경우 감사 로그와 함께 열어 같은 요청에서 어떤 관리 작업이나 접근 거부가 이어졌는지 확인합니다.',
          'IP 해시는 원문 IP가 아니므로 동일 해시가 짧은 시간에 반복되는지 기준으로 패턴을 봅니다.'
        ]
      },
      {
        title: '필터 사용법',
        items: [
          '심각도는 긴급, 높음, 주의, 낮음 순서로 좁혀 보며 운영 대응 우선순위를 정합니다.',
          '분류는 인증, 회원가입, 세션, 접근 제어처럼 사건 유형을 나누는 기준입니다.',
          '사용자 ID나 요청번호를 알고 있다면 해당 값으로 바로 좁혀 상세 흐름을 확인합니다.'
        ]
      },
      {
        title: '다음 작업',
        items: [
          '반복 로그인 실패와 가입 제한은 인증 정책, 계정 잠금 기준, 안내 문구를 함께 점검합니다.',
          '세션 재사용 감지는 해당 사용자의 세션 만료와 비밀번호 변경 안내까지 이어서 확인합니다.',
          '권한 거부나 출처 차단이 반복되면 배포 도메인, 브라우저 출처 설정, 메뉴 권한 정책을 함께 확인합니다.'
        ],
        links: [
          {
            title: '감사 로그',
            href: '/admin/logs',
            description:
              '요청번호 기준으로 관리자 작업과 접근 거부 흐름을 함께 추적합니다.',
            actionLabel: '감사 로그 열기'
          },
          {
            title: '회원 관리',
            href: '/admin/members',
            description:
              '의심 사용자나 멤버십 상태를 확인하고 필요한 경우 상태 조정을 검토합니다.',
            actionLabel: '회원 관리 열기'
          }
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
      severity: draftSeverity
        ? (draftSeverity as AdminSecurityThreatSeverity)
        : undefined,
      eventCategory: draftCategory
        ? (draftCategory as AdminSecurityThreatCategory)
        : undefined,
      eventName: draftEventName.trim() || undefined,
      requestId: draftRequestId.trim() || undefined,
      clientIpHash: draftClientIpHash.trim() || undefined,
      userId: draftUserId.trim() || undefined
    });
  }

  function clearFilters() {
    setDraftSeverity('');
    setDraftCategory('');
    setDraftEventName('');
    setDraftRequestId('');
    setDraftClientIpHash('');
    setDraftUserId('');
    setFilters({
      limit: 50,
      offset: 0
    });
  }

  const columns = useMemo<GridColDef<AdminSecurityThreatEventItem>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: '발생 시각',
        minWidth: 180,
        valueFormatter: (value) => formatDateTime(String(value))
      },
      {
        field: 'severity',
        headerName: '심각도',
        width: 110,
        renderCell: (params) => (
          <Chip
            label={readSecurityThreatSeverityLabel(params.row.severity)}
            color={readSeverityColor(params.row.severity)}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, fontWeight: 700 }}
          />
        )
      },
      {
        field: 'eventCategory',
        headerName: '분류',
        width: 130,
        valueFormatter: (value) =>
          readSecurityThreatCategoryLabel(String(value))
      },
      { field: 'eventName', headerName: '이벤트', flex: 1, minWidth: 230 },
      { field: 'reason', headerName: '사유', flex: 1, minWidth: 180 },
      { field: 'requestId', headerName: '요청번호', flex: 1, minWidth: 220 },
      {
        field: 'clientIpHash',
        headerName: 'IP 해시',
        flex: 1,
        minWidth: 220
      },
      { field: 'userId', headerName: '사용자 ID', flex: 1, minWidth: 190 },
      {
        field: 'detail',
        headerName: '상세',
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button size="small" onClick={() => setSelectedEvent(params.row)}>
            보기
          </Button>
        )
      }
    ],
    []
  );

  const currentItems = threatEventsQuery.data?.items ?? [];
  const urgentCount = currentItems.filter((item) =>
    ['CRITICAL', 'HIGH'].includes(item.severity)
  ).length;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전체 관리자"
        title="보안 위협 로그"
        badges={[
          {
            label: canReadThreatLogs ? '전체 관리자 전용' : '조회 권한 없음',
            color: canReadThreatLogs ? 'success' : 'warning'
          },
          ...(activeFilterCount > 0
            ? [{ label: `필터 ${activeFilterCount}개` }]
            : [])
        ]}
        secondaryActionLabel="감사 로그"
        secondaryActionHref="/admin/logs"
        secondaryActionDisabled={!canReadThreatLogs}
      />

      {!canReadThreatLogs ? (
        <Alert severity="warning" variant="outlined">
          보안 위협 로그는 전체 관리자 계정에서만 조회할 수 있습니다.
        </Alert>
      ) : null}

      {threatEventsQuery.error ? (
        <QueryErrorAlert
          title="보안 위협 로그를 불러오지 못했습니다."
          error={threatEventsQuery.error}
        />
      ) : null}

      <DataTableCard
        title="보안 위협 이벤트"
        description={`총 ${threatEventsQuery.data?.total ?? 0}건 · 현재 목록의 긴급/높음 ${urgentCount}건`}
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
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  select
                  fullWidth
                  label="심각도"
                  value={draftSeverity}
                  onChange={(event) => setDraftSeverity(event.target.value)}
                  size="small"
                >
                  <MenuItem value="">전체</MenuItem>
                  {SECURITY_THREAT_SEVERITIES.map((severity) => (
                    <MenuItem key={severity} value={severity}>
                      {readSecurityThreatSeverityLabel(severity)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  select
                  fullWidth
                  label="분류"
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                  size="small"
                >
                  <MenuItem value="">전체</MenuItem>
                  {SECURITY_THREAT_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {readSecurityThreatCategoryLabel(category)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  fullWidth
                  label="이벤트"
                  value={draftEventName}
                  onChange={(event) => setDraftEventName(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  fullWidth
                  label="요청번호"
                  value={draftRequestId}
                  onChange={(event) => setDraftRequestId(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  fullWidth
                  label="IP 해시"
                  value={draftClientIpHash}
                  onChange={(event) => setDraftClientIpHash(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
                <TextField
                  fullWidth
                  label="사용자 ID"
                  value={draftUserId}
                  onChange={(event) => setDraftUserId(event.target.value)}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    disabled={!canReadThreatLogs}
                    onClick={applyFilters}
                  >
                    필터 적용
                  </Button>
                  {activeFilterCount > 0 ? (
                    <Button
                      sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
                      onClick={clearFilters}
                    >
                      초기화
                    </Button>
                  ) : null}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        }
        rows={currentItems}
        columns={columns}
        height={560}
      />

      <FormDrawer
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title="보안 위협 상세"
        description={selectedEvent?.eventName}
      >
        {selectedEvent ? (
          <Stack spacing={1.5}>
            <Detail
              label="심각도"
              value={readSecurityThreatSeverityLabel(selectedEvent.severity)}
            />
            <Detail
              label="분류"
              value={readSecurityThreatCategoryLabel(
                selectedEvent.eventCategory
              )}
            />
            <Detail label="이벤트" value={selectedEvent.eventName} />
            <Detail label="사유" value={selectedEvent.reason ?? '-'} />
            <Detail label="요청번호" value={selectedEvent.requestId ?? '-'} />
            <Detail label="경로" value={selectedEvent.path ?? '-'} />
            <Detail label="IP 해시" value={selectedEvent.clientIpHash ?? '-'} />
            <Detail label="사용자 ID" value={selectedEvent.userId ?? '-'} />
            <Detail label="세션 ID" value={selectedEvent.sessionId ?? '-'} />
            <Detail label="출처" value={selectedEvent.source} />
            <Detail
              label="추가 정보"
              value={
                selectedEvent.metadata
                  ? JSON.stringify(selectedEvent.metadata)
                  : '-'
              }
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                    setSelectedEvent(null);
                  }}
                >
                  같은 요청번호로 보기
                </Button>
              ) : null}
              {selectedEvent.clientIpHash ? (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDraftClientIpHash(selectedEvent.clientIpHash ?? '');
                    setFilters({
                      limit: 50,
                      offset: 0,
                      clientIpHash: selectedEvent.clientIpHash ?? undefined
                    });
                    setSelectedEvent(null);
                  }}
                >
                  같은 IP 해시로 보기
                </Button>
              ) : null}
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

function readSeverityColor(
  severity: AdminSecurityThreatSeverity
): ChipProps['color'] {
  switch (severity) {
    case 'CRITICAL':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'info';
    case 'LOW':
      return 'default';
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().replace('T', ' ').slice(0, 19);
}
