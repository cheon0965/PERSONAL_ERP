'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
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
        description="API, DB readiness, 감사 로그, 메일 경계와 최근 운영 활동을 운영자 관점에서 확인합니다."
        badges={[
          {
            label: readSystemComponentStatusLabel(status?.overallStatus ?? 'UNKNOWN'),
            color: readSystemComponentStatusColor(status?.overallStatus ?? 'UNKNOWN')
          },
          {
            label: status?.mail.provider ?? '메일 제공자 미확인',
            color: 'default'
          }
        ]}
        metadata={[
          {
            label: '프로세스 업타임',
            value: `${formatNumber(status?.build.uptimeSeconds ?? 0, 0)}초`
          },
          {
            label: '최근 실패 이벤트',
            value: formatDateTime(status?.recentActivity.lastFailedAuditEventAt ?? null)
          },
          {
            label: '최근 업로드',
            value: formatDateTime(status?.recentActivity.lastImportUploadedAt ?? null)
          },
          {
            label: '환경',
            value: status?.build.environment ?? '-'
          }
        ]}
        primaryActionLabel="헬스체크 열기"
        primaryActionHref="/api/health"
        secondaryActionLabel="감사 로그"
        secondaryActionHref="/admin/logs"
      />

      <OperationsSectionNav />

      {systemStatusQuery.error ? (
        <QueryErrorAlert
          title="시스템 상태를 불러오지 못했습니다."
          error={systemStatusQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="지금 우선 확인"
            description="시스템 상태를 빠르게 판단할 핵심 운영 경계만 상단에서 먼저 보여줍니다."
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <SystemInfoItem
                  label="전체 상태"
                  value={readSystemComponentStatusLabel(
                    status?.overallStatus ?? 'UNKNOWN'
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <SystemInfoItem
                  label="메일 제공자"
                  value={status?.mail.provider ?? '-'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <SystemInfoItem
                  label="프로세스 업타임"
                  value={`${formatNumber(status?.build.uptimeSeconds ?? 0, 0)}초`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <SystemInfoItem
                  label="최근 실패 이벤트"
                  value={formatDateTime(
                    status?.recentActivity.lastFailedAuditEventAt ?? null
                  )}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="자주 여는 후속 화면"
            description="상태 이상이 보일 때 바로 이어서 확인하는 대표 운영 화면입니다."
          >
            <Stack spacing={1.25}>
              <SystemStatusNavCard
                title="감사 로그"
                description="최근 성공/실패 이벤트와 보안 관련 흐름을 requestId 기준으로 추적합니다."
                href="/admin/logs"
                actionLabel="감사 로그 보기"
              />
              <SystemStatusNavCard
                title="헬스체크"
                description="서비스 응답과 기본 상태를 직접 확인합니다."
                href="/api/health"
                actionLabel="헬스체크 열기"
              />
            </Stack>
          </SectionCard>
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

function SystemInfoItem({
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
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function SystemStatusNavCard({
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
