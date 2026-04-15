'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getOperationsImportStatus,
  operationsImportStatusQueryKey
} from './operations.api';
import {
  readImportBatchParseStatusLabel,
  readImportSourceKindLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsImportStatusPage() {
  const importStatusQuery = useQuery({
    queryKey: operationsImportStatusQueryKey,
    queryFn: getOperationsImportStatus
  });
  const importStatus = importStatusQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="업로드 운영 현황"
        description="최근 업로드 배치의 실패 행과 미수집 행을 확인하고, 바로 처리 화면으로 이동합니다."
        badges={[
          {
            label: `${formatNumber(importStatus?.totalBatchCount ?? 0, 0)}개 배치`,
            color: (importStatus?.totalBatchCount ?? 0) > 0 ? 'primary' : 'default'
          },
          {
            label:
              (importStatus?.uncollectedRowCount ?? 0) > 0
                ? '미수집 행 있음'
                : '미수집 행 없음',
            color:
              (importStatus?.uncollectedRowCount ?? 0) > 0 ? 'warning' : 'success'
          }
        ]}
        metadata={[
          {
            label: '전체 행',
            value: `${formatNumber(importStatus?.totalRowCount ?? 0, 0)}개`
          },
          {
            label: '실패 행',
            value: `${formatNumber(importStatus?.failedRowCount ?? 0, 0)}개`
          },
          {
            label: '미수집 행',
            value: `${formatNumber(importStatus?.uncollectedRowCount ?? 0, 0)}개`
          },
          {
            label: '승격률',
            value: `${formatNumber((importStatus?.collectionRate ?? 0) * 100, 1)}%`
          }
        ]}
        primaryActionLabel="업로드 배치 화면"
        primaryActionHref="/imports"
        secondaryActionLabel="예외 처리함"
        secondaryActionHref="/operations/exceptions"
      />

      <OperationsSectionNav />

      {importStatusQuery.error ? (
        <QueryErrorAlert
          title="업로드 운영 현황을 불러오지 못했습니다."
          error={importStatusQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="지금 우선 확인"
            description="운영자가 먼저 확인해야 할 업로드 상태를 짧게 압축해 보여줍니다."
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ImportStatusInfoItem
                  label="최근 업로드"
                  value={formatDateTime(importStatus?.latestUploadedAt ?? null)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ImportStatusInfoItem
                  label="미수집 행"
                  value={`${formatNumber(importStatus?.uncollectedRowCount ?? 0, 0)}개`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ImportStatusInfoItem
                  label="실패 행"
                  value={`${formatNumber(importStatus?.failedRowCount ?? 0, 0)}개`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ImportStatusInfoItem
                  label="승격률"
                  value={`${formatNumber((importStatus?.collectionRate ?? 0) * 100, 1)}%`}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="바로 이동"
            description="업로드 운영 현황에서 자주 이어서 여는 처리 화면입니다."
          >
            <Stack spacing={1.25}>
              <OperationsLinkCard
                title="업로드 배치"
                description="원본 업로드, 행 검토, 승격 처리를 바로 이어서 진행합니다."
                href="/imports"
                actionLabel="업로드 배치 열기"
              />
              <OperationsLinkCard
                title="예외 처리함"
                description="미수집 행과 업로드 관련 예외를 우선순위로 다시 확인합니다."
                href="/operations/exceptions"
                actionLabel="예외 처리 보기"
              />
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard
        title="최근 업로드 배치"
        description="배치별 상태를 먼저 확인한 뒤, 실제 행 처리와 승격은 업로드 배치 화면으로 이어서 진행합니다."
      >
        <Stack spacing={1.5}>
          {(importStatus?.batches ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              아직 업로드 배치가 없습니다.
            </Typography>
          ) : null}
          {(importStatus?.batches ?? []).map((batch) => (
            <Box
              key={batch.id}
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
                  spacing={1}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{batch.fileName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(batch.uploadedAt)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={readImportSourceKindLabel(batch.sourceKind)}
                      variant="outlined"
                      size="small"
                    />
                    <Chip
                      label={readImportBatchParseStatusLabel(batch.parseStatus)}
                      color={batch.failedRowCount > 0 ? 'warning' : 'success'}
                      size="small"
                    />
                  </Stack>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, batch.collectionRate * 100)}
                  sx={{ height: 8, borderRadius: 999 }}
                />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  color="text.secondary"
                >
                  <Typography variant="body2">
                    행 {formatNumber(batch.rowCount, 0)}개
                  </Typography>
                  <Typography variant="body2">
                    실패 {formatNumber(batch.failedRowCount, 0)}개
                  </Typography>
                  <Typography variant="body2">
                    미수집 {formatNumber(batch.uncollectedRowCount, 0)}개
                  </Typography>
                  <Typography variant="body2">
                    승격률 {formatNumber(batch.collectionRate * 100, 1)}%
                  </Typography>
                </Stack>
                <Button component={Link} href="/imports" variant="outlined">
                  업로드 배치에서 처리
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function ImportStatusInfoItem({
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

function OperationsLinkCard({
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
