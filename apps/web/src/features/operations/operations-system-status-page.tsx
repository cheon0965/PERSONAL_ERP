'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  getOperationsSystemStatus,
  operationsSystemStatusQueryKey
} from './operations.api';
import {
  readSystemComponentStatusColor,
  readSystemComponentStatusLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsSystemStatusPage() {
  const systemStatusQuery = useQuery({
    queryKey: operationsSystemStatusQueryKey,
    queryFn: getOperationsSystemStatus
  });
  const status = systemStatusQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="시스템 상태 / 헬스"
        description="API, DB readiness, 감사 로그, 메일 발송 경계와 최근 운영 활동을 내부 운영자 관점에서 확인합니다."
        primaryActionLabel="헬스체크 열기"
        primaryActionHref="/api/health"
      />

      <OperationsSectionNav />

      {systemStatusQuery.error ? (
        <QueryErrorAlert
          title="시스템 상태를 불러오지 못했습니다."
          error={systemStatusQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="전체 상태"
            value={readSystemComponentStatusLabel(
              status?.overallStatus ?? 'UNKNOWN'
            )}
            tone={status?.overallStatus === 'OPERATIONAL' ? 'success' : 'warning'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="메일 제공자"
            value={status?.mail.provider ?? '-'}
            subtitle={status?.mail.detail ?? '메일 경계 상태를 계산 중입니다.'}
            tone="neutral"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="프로세스 업타임"
            value={`${formatNumber(status?.build.uptimeSeconds ?? 0, 0)}초`}
            subtitle={status?.build.environment ?? '-'}
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="최근 실패 이벤트"
            value={formatDateTime(status?.recentActivity.lastFailedAuditEventAt ?? null)}
            tone="warning"
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="상태 체크"
            description="인프라 관측 도구를 대체하지 않고, 운영자가 빠르게 분리 판단할 핵심 경계만 보여줍니다."
          >
            <Stack spacing={1.5}>
              {(status?.components ?? []).map((component) => (
                <Box
                  key={component.key}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                    >
                      <Typography variant="subtitle2">
                        {component.label}
                      </Typography>
                      <Chip
                        label={readSystemComponentStatusLabel(component.status)}
                        color={readSystemComponentStatusColor(component.status)}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {component.detail}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      마지막 확인: {formatDateTime(component.lastCheckedAt)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="빌드와 최근 활동" description="민감한 설정값은 표시하지 않습니다.">
            <Stack spacing={1.5}>
              <Detail label="환경" value={status?.build.environment ?? '-'} />
              <Detail label="Node" value={status?.build.nodeVersion ?? '-'} />
              <Detail label="버전" value={status?.build.appVersion ?? '-'} />
              <Detail label="Commit" value={status?.build.commitSha ?? '-'} />
              <Detail
                label="최근 성공 감사 로그"
                value={formatDateTime(
                  status?.recentActivity.lastSuccessfulAuditEventAt ?? null
                )}
              />
              <Detail
                label="최근 업로드"
                value={formatDateTime(
                  status?.recentActivity.lastImportUploadedAt ?? null
                )}
              />
              <Button component={Link} href="/admin/logs" variant="outlined">
                감사 로그 보기
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
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
