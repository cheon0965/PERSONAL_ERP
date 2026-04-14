'use client';

import { useState } from 'react';
import type { OperationsExportResult } from '@personal-erp/contracts';
import { Alert, Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  getOperationsExports,
  operationsExportsQueryKey,
  runOperationsExport
} from './operations.api';
import { readOperationsExportScopeLabel } from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsExportsPage() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<OperationsExportResult | null>(
    null
  );
  const exportsQuery = useQuery({
    queryKey: operationsExportsQueryKey,
    queryFn: getOperationsExports
  });
  const exportMutation = useMutation({
    mutationFn: runOperationsExport,
    onSuccess: async (result) => {
      setLastResult(result);
      downloadCsv(result);
      await queryClient.invalidateQueries({
        queryKey: operationsExportsQueryKey
      });
    }
  });
  const exports = exportsQuery.data;
  const totalRows =
    exports?.items.reduce((sum, item) => sum + item.rowCount, 0) ?? 0;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="백업 / 내보내기"
        description="운영자가 직접 실행하는 UTF-8 CSV 반출입니다. 기준 데이터, 수집 거래, 전표, 재무제표 스냅샷을 감사 로그와 함께 남깁니다."
      />

      <OperationsSectionNav />

      {exportsQuery.error ? (
        <QueryErrorAlert
          title="내보내기 상태를 불러오지 못했습니다."
          error={exportsQuery.error}
        />
      ) : null}

      {exportMutation.error ? (
        <Alert severity="error">
          {exportMutation.error instanceof Error
            ? exportMutation.error.message
            : 'CSV 내보내기를 실행하지 못했습니다.'}
        </Alert>
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="반출 범위"
            value={formatNumber(exports?.items.length ?? 0, 0)}
            subtitle="운영 1차 범위"
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="대상 행 수"
            value={formatNumber(totalRows, 0)}
            subtitle="현재 장부 기준"
            tone="neutral"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="마지막 반출"
            value={formatDateTime(exports?.lastExportedAt ?? null)}
            tone="warning"
          />
        </Grid>
      </Grid>

      <SectionCard
        title="수동 CSV 반출"
        description="스케줄 백업이나 DB 스냅샷은 아직 다루지 않고, 운영자가 필요한 시점에 내려받는 안전한 1차 흐름부터 제공합니다."
      >
        <Stack spacing={1.5}>
          {(exports?.items ?? []).map((item) => (
            <Box
              key={item.scope}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ md: 'center' }}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={readOperationsExportScopeLabel(item.scope)}
                      color={item.enabled ? 'primary' : 'default'}
                      size="small"
                    />
                    <Chip
                      label={item.rangeLabel}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    권장: {item.recommendedCadence}
                  </Typography>
                </Stack>
                <Typography variant="subtitle2">{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  대상 {formatNumber(item.rowCount, 0)}행 · 원본 최신 변경{' '}
                  {formatDateTime(item.latestSourceAt)} · 마지막 반출{' '}
                  {formatDateTime(item.latestExportedAt)}
                </Typography>
                <Button
                  variant="outlined"
                  disabled={!item.enabled || exportMutation.isPending}
                  onClick={() => exportMutation.mutate({ scope: item.scope })}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {exportMutation.isPending ? 'CSV 생성 중...' : 'CSV 생성'}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      {lastResult ? (
        <SectionCard
          title="최근 생성 결과"
          description={`${lastResult.fileName} · ${lastResult.encoding.toUpperCase()} · ${formatNumber(lastResult.rowCount, 0)}행`}
        >
          <Typography
            component="pre"
            variant="caption"
            sx={{
              m: 0,
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {lastResult.payload.split(/\r?\n/).slice(0, 6).join('\n')}
          </Typography>
        </SectionCard>
      ) : null}
    </Stack>
  );
}

function downloadCsv(result: OperationsExportResult) {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([result.payload], { type: result.contentType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
