'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
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
        description="최근 업로드 배치의 실패 행, 미수집 행, 수집 승격률을 운영자 관점에서 확인합니다."
        primaryActionLabel="업로드 배치 화면"
        primaryActionHref="/imports"
      />

      <OperationsSectionNav />

      {importStatusQuery.error ? (
        <QueryErrorAlert
          title="업로드 운영 현황을 불러오지 못했습니다."
          error={importStatusQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="업로드 배치"
            value={formatNumber(importStatus?.totalBatchCount ?? 0, 0)}
            tone="neutral"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="전체 행"
            value={formatNumber(importStatus?.totalRowCount ?? 0, 0)}
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="미수집 행"
            value={formatNumber(importStatus?.uncollectedRowCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="수집 승격률"
            value={`${formatNumber((importStatus?.collectionRate ?? 0) * 100, 1)}%`}
            subtitle={`최근 업로드: ${formatDateTime(importStatus?.latestUploadedAt ?? null)}`}
            tone="success"
          />
        </Grid>
      </Grid>

      <SectionCard
        title="최근 업로드 배치"
        description="원본 상세 처리는 기존 업로드 배치 화면에서 계속 수행합니다."
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
