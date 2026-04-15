'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getOperationsAlerts,
  operationsAlertsQueryKey
} from './operations.api';
import {
  readOperationsAlertKindLabel,
  readOperationsSeverityColor,
  readOperationsSeverityLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsAlertsPage() {
  const alertsQuery = useQuery({
    queryKey: operationsAlertsQueryKey,
    queryFn: getOperationsAlerts
  });
  const alerts = alertsQuery.data;

  useDomainHelp({
    title: '운영 알림 가이드',
    description:
      '운영 알림은 월 마감, 업로드, 보안 관련 경고를 우선순위대로 모아 보는 화면입니다.',
    primaryEntity: 'OperationsAlertItem',
    relatedEntities: ['WorkspaceAuditEvent', 'ImportBatch', 'AccountingPeriod'],
    truthSource:
      '알림은 운영 이벤트와 예외 상태를 기반으로 만든 즉시 확인용 read model입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="알림 / 이벤트 센터"
        description="마감 차단, 업로드 오류, 기준 데이터 부족, 보안 이벤트를 파생 알림으로 모아봅니다."
        badges={[
          {
            label:
              (alerts?.criticalCount ?? 0) > 0 ? '긴급 알림 있음' : '긴급 알림 없음',
            color: (alerts?.criticalCount ?? 0) > 0 ? 'warning' : 'success'
          },
          {
            label: `${formatNumber(alerts?.totalCount ?? 0, 0)}건`,
            color: (alerts?.totalCount ?? 0) > 0 ? 'primary' : 'default'
          }
        ]}
        metadata={[
          {
            label: '전체 알림',
            value: `${formatNumber(alerts?.totalCount ?? 0, 0)}건`
          },
          {
            label: '긴급',
            value: `${formatNumber(alerts?.criticalCount ?? 0, 0)}건`
          },
          {
            label: '경고',
            value: `${formatNumber(alerts?.warningCount ?? 0, 0)}건`
          }
        ]}
        primaryActionLabel="예외 처리함"
        primaryActionHref="/operations/exceptions"
        secondaryActionLabel="시스템 상태"
        secondaryActionHref="/operations/status"
      />

      <OperationsSectionNav />

      {alertsQuery.error ? (
        <QueryErrorAlert
          title="운영 알림을 불러오지 못했습니다."
          error={alertsQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="지금 우선 확인"
            description="현재 알림 규모와 우선순위를 먼저 확인하고 본문 목록으로 내려갑니다."
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AlertInfoItem
                  label="전체 알림"
                  value={`${formatNumber(alerts?.totalCount ?? 0, 0)}건`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AlertInfoItem
                  label="긴급"
                  value={`${formatNumber(alerts?.criticalCount ?? 0, 0)}건`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AlertInfoItem
                  label="경고"
                  value={`${formatNumber(alerts?.warningCount ?? 0, 0)}건`}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="자주 여는 후속 화면"
            description="알림을 읽은 뒤 실제 원인을 확인하러 자주 이동하는 화면입니다."
          >
            <Stack spacing={1.25}>
              <OperationsAlertsNavCard
                title="예외 처리함"
                description="알림의 원인이 되는 운영 예외를 우선순위 기준으로 다시 확인합니다."
                href="/operations/exceptions"
                actionLabel="예외 처리 보기"
              />
              <OperationsAlertsNavCard
                title="시스템 상태"
                description="시스템/메일/최근 활동 경계에서 실제 이상이 있는지 함께 점검합니다."
                href="/operations/status"
                actionLabel="시스템 상태 보기"
              />
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard
        title="파생 알림"
        description="읽음/확인 처리는 다음 단계로 미루고, 1차에서는 근거 화면으로 이동하는 데 집중합니다."
      >
        <Stack spacing={1.5}>
          {(alerts?.items ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              현재 표시할 운영 알림이 없습니다.
            </Typography>
          ) : null}
          {(alerts?.items ?? []).map((alert) => (
            <Box
              key={alert.id}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ md: 'center' }}
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={readOperationsSeverityLabel(alert.severity)}
                      color={readOperationsSeverityColor(alert.severity)}
                      size="small"
                    />
                    <Chip
                      label={readOperationsAlertKindLabel(alert.kind)}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(alert.createdAt)}
                  </Typography>
                </Stack>
                <Typography variant="subtitle2">{alert.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {alert.description}
                </Typography>
                {alert.requestId ? (
                  <Typography variant="caption" color="text.secondary">
                    Request ID: {alert.requestId}
                  </Typography>
                ) : null}
                <Button
                  component={Link}
                  href={alert.href}
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {alert.actionLabel}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function AlertInfoItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}

function OperationsAlertsNavCard({
  title,
  description,
  href,
  actionLabel
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined">
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
