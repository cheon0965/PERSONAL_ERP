'use client';

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Alert,
  Chip,
  Grid,
  Stack,
  Typography,
  type ChipProps
} from '@mui/material';
import type {
  AdminAuditEventItem,
  AdminOperationsStatusComponent,
  AdminSecurityThreatEventItem
} from '@personal-erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  adminOperationsStatusQueryKey,
  getAdminOperationsStatus
} from './admin.api';
import {
  readAuditResultLabel,
  readOperationsStatusLabel,
  readSecurityThreatSeverityLabel
} from './admin-labels';

export function AdminOperationsStatusPage() {
  const { user } = useAuthSession();
  const canRead = user?.isSystemAdmin === true;
  const statusQuery = useQuery({
    queryKey: adminOperationsStatusQueryKey,
    queryFn: getAdminOperationsStatus,
    enabled: canRead
  });

  useDomainHelp({
    title: '운영 상태 가이드',
    description:
      '운영 상태는 전체 관리자가 배포 후 가장 먼저 보는 점검판입니다. 사용자, 사업장, 보안 위협, 감사 실패 지표를 한 화면에서 확인합니다.',
    primaryEntity: '운영 상태',
    relatedEntities: ['사용자', '사업장', '보안 위협 로그', '감사 로그'],
    truthSource:
      '운영 상태는 서버가 현재 DB와 최근 24시간 이벤트를 읽어 계산한 점검 결과입니다.',
    supplementarySections: [
      {
        title: '확인 기준',
        items: [
          '오류 상태 컴포넌트가 있으면 배포나 운영 확인을 멈추고 해당 항목부터 확인합니다.',
          '최근 24시간 긴급/높음 보안 위협과 실패/거부 감사 이벤트는 운영 리스크 신호로 먼저 봅니다.',
          '잠금 사용자와 중지 사업장 수가 예상보다 많으면 계정 상태와 사업장 상태 변경 이력을 함께 확인합니다.'
        ]
      },
      {
        title: '운영 판단 기준',
        items: [
          'API와 DB가 정상이고 보안/감사 경고가 0건이면 기본 운영 점검을 통과한 상태로 봅니다.',
          'Prisma migration 항목은 운영 DB 상세 비교가 아니므로 배포 절차의 DB 상태 확인과 함께 판단합니다.',
          '메일 설정 경고는 계정 초대, 비밀번호 변경, 이메일 인증 흐름의 실제 발송 테스트로 보완합니다.'
        ]
      },
      {
        title: '후속 안내',
        links: [
          {
            title: '보안 위협 로그',
            href: '/admin/security-threats',
            description:
              '긴급/높음 위협이 있으면 이벤트 상세와 반복 패턴을 먼저 확인합니다.',
            actionLabel: '보안 위협 로그 열기'
          },
          {
            title: '감사 로그',
            href: '/admin/logs',
            description:
              '실패 또는 거부 감사 이벤트의 요청번호와 작업 대상을 추적합니다.',
            actionLabel: '감사 로그 열기'
          },
          {
            title: '사업장 관리',
            href: '/admin/tenants',
            description:
              '중지 사업장이나 기본 장부 누락 사업장을 상세 확인합니다.',
            actionLabel: '사업장 관리 열기'
          }
        ]
      }
    ]
  });

  const status = statusQuery.data;
  const metrics = status?.metrics;
  const warningComponents =
    status?.components.filter((component) =>
      ['WARNING', 'ERROR', 'UNKNOWN'].includes(component.status)
    ) ?? [];

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전체 관리자"
        title="운영 상태"
        badges={[
          {
            label: canRead ? '전체 관리자 전용' : '조회 권한 없음',
            color: canRead ? 'success' : 'warning'
          },
          {
            label:
              warningComponents.length > 0
                ? `주의 ${warningComponents.length}개`
                : '전체 정상',
            color: warningComponents.length > 0 ? 'warning' : 'success'
          }
        ]}
        primaryActionLabel="새로고침"
        primaryActionOnClick={() => void statusQuery.refetch()}
        primaryActionDisabled={!canRead || statusQuery.isFetching}
      />

      {!canRead ? (
        <Alert severity="warning" variant="outlined">
          운영 상태는 전체 관리자만 조회할 수 있습니다.
        </Alert>
      ) : null}
      {statusQuery.error ? (
        <QueryErrorAlert
          title="운영 상태를 불러오지 못했습니다."
          error={statusQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="전체 사용자"
            value={`${metrics?.totalUsers ?? 0}명`}
            subtitle={`잠금/비활성 ${metrics?.lockedUsers ?? 0}명`}
            tone={(metrics?.lockedUsers ?? 0) > 0 ? 'warning' : 'success'}
            icon={ShieldRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="전체 사업장"
            value={`${metrics?.totalTenants ?? 0}곳`}
            subtitle={`활성 ${metrics?.activeTenants ?? 0}곳 · 중지 ${metrics?.suspendedTenants ?? 0}곳`}
            tone={(metrics?.suspendedTenants ?? 0) > 0 ? 'warning' : 'success'}
            icon={StorageRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="24시간 보안 위협"
            value={`${metrics?.highThreats24h ?? 0}건`}
            subtitle="긴급/높음 등급 이벤트"
            tone={(metrics?.highThreats24h ?? 0) > 0 ? 'warning' : 'success'}
            icon={WarningAmberRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            title="24시간 감사 실패"
            value={`${metrics?.failedAuditEvents24h ?? 0}건`}
            subtitle="실패 또는 거부 감사 이벤트"
            tone={
              (metrics?.failedAuditEvents24h ?? 0) > 0 ? 'warning' : 'success'
            }
            icon={RefreshRoundedIcon}
          />
        </Grid>
      </Grid>

      <SectionCard
        title="컴포넌트 점검"
        description={`마지막 확인 시각 ${status ? formatDateTime(status.checkedAt) : '-'}`}
      >
        <Grid container spacing={appLayout.fieldGap}>
          {(status?.components ?? []).map((component) => (
            <Grid key={component.key} size={{ xs: 12, md: 6, xl: 4 }}>
              <StatusComponentCard component={component} />
            </Grid>
          ))}
          {!status?.components.length ? (
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                아직 표시할 컴포넌트 점검 결과가 없습니다.
              </Typography>
            </Grid>
          ) : null}
        </Grid>
      </SectionCard>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <SectionCard
            title="최근 보안 위협"
            description="긴급/높음 등급 위협 이벤트를 최신순으로 표시합니다."
          >
            <Stack spacing={1.25}>
              {(status?.recentSecurityThreats ?? []).map((event) => (
                <SecurityThreatRow key={event.id} event={event} />
              ))}
              {!status?.recentSecurityThreats.length ? (
                <Typography variant="body2" color="text.secondary">
                  최근 긴급/높음 보안 위협이 없습니다.
                </Typography>
              ) : null}
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <SectionCard
            title="최근 감사 실패/거부"
            description="실패 또는 거부 결과의 감사 이벤트를 최신순으로 표시합니다."
          >
            <Stack spacing={1.25}>
              {(status?.recentAuditEvents ?? []).map((event) => (
                <AuditEventRow key={event.id} event={event} />
              ))}
              {!status?.recentAuditEvents.length ? (
                <Typography variant="body2" color="text.secondary">
                  최근 실패/거부 감사 이벤트가 없습니다.
                </Typography>
              ) : null}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

function StatusComponentCard({
  component
}: {
  component: AdminOperationsStatusComponent;
}) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        height: '100%',
        p: appLayout.cardPadding,
        borderRadius: 2,
        border: '1px solid',
        borderColor:
          component.status === 'ERROR'
            ? 'error.light'
            : component.status === 'WARNING'
              ? 'warning.light'
              : 'divider',
        bgcolor:
          component.status === 'ERROR'
            ? brandTokens.palette.errorSoft
            : component.status === 'WARNING'
              ? brandTokens.palette.warningSoft
              : 'background.default'
      }}
    >
      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Typography variant="subtitle2">{component.label}</Typography>
        <Chip
          label={readOperationsStatusLabel(component.status)}
          color={readOperationsStatusColor(component.status)}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 1.5, fontWeight: 700 }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {component.message}
      </Typography>
    </Stack>
  );
}

function SecurityThreatRow({ event }: { event: AdminSecurityThreatEventItem }) {
  return (
    <Stack
      spacing={0.75}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip
          label={readSecurityThreatSeverityLabel(event.severity)}
          color={event.severity === 'CRITICAL' ? 'error' : 'warning'}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 1.5, fontWeight: 700 }}
        />
        <Typography variant="subtitle2">{event.eventName}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {formatDateTime(event.occurredAt)} · 요청번호 {event.requestId ?? '-'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {event.reason ?? '사유 정보 없음'}
      </Typography>
    </Stack>
  );
}

function AuditEventRow({ event }: { event: AdminAuditEventItem }) {
  return (
    <Stack
      spacing={0.75}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip
          label={readAuditResultLabel(event.result)}
          color={event.result === 'FAILED' ? 'error' : 'warning'}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 1.5, fontWeight: 700 }}
        />
        <Typography variant="subtitle2">{event.eventName}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {formatDateTime(event.occurredAt)} · 요청번호 {event.requestId ?? '-'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {event.reason ?? event.action ?? '상세 사유 정보 없음'}
      </Typography>
    </Stack>
  );
}

function readOperationsStatusColor(
  status: AdminOperationsStatusComponent['status']
): ChipProps['color'] {
  switch (status) {
    case 'OK':
      return 'success';
    case 'WARNING':
      return 'warning';
    case 'ERROR':
      return 'error';
    case 'UNKNOWN':
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
