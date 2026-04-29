'use client';

import { useState } from 'react';
import type { OperationsExportResult } from '@personal-erp/contracts';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
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
  useDomainHelp({
    title: '백업 / 내보내기 가이드',
    description:
      '백업 / 내보내기 화면은 운영 데이터를 어떤 범위로 반출할지 선택하는 화면입니다.',
    primaryEntity: '내보내기 결과',
    relatedEntities: ['업로드 배치', '수집 거래', '전표'],
    truthSource:
      '내보내기 가능 범위와 최근 실행 결과는 서버가 제공하는 내보내기 기준을 따라 표시됩니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '상단에서 반출 범위 수, 대상 행 수, 마지막 반출 시각을 먼저 확인합니다.',
          '반출 범위 목록에서 필요한 데이터 범위를 고르고 행 수가 예상과 맞는지 확인합니다.',
          'CSV 반출을 실행하면 UTF-8 CSV가 내려받아지고 최근 반출 이력이 갱신됩니다.',
          '개인정보나 운영 민감 데이터가 포함될 수 있으므로 공유 전 범위와 목적을 다시 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '감사 로그',
            description: '수동 반출 실행 전후의 운영 이벤트와 요청 흐름을 함께 확인합니다.',
            href: '/admin/logs',
            actionLabel: '감사 로그 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description: '공식 스냅샷이 최신인지 확인한 뒤 재무제표 범위를 반출합니다.',
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          }
        ]
      }
    ]
  });
  const totalRows =
    exports?.items.reduce((sum, item) => sum + item.rowCount, 0) ?? 0;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="백업 / 내보내기"
        description="운영자가 직접 실행하는 UTF-8 CSV 반출로, 기준 데이터와 운영 결과를 안전하게 내려받습니다."
        badges={[
          {
            label: `${formatNumber(exports?.items.length ?? 0, 0)}개 범위`,
            color: (exports?.items.length ?? 0) > 0 ? 'primary' : 'default'
          },
          {
            label: exports?.lastExportedAt
              ? '최근 반출 이력 있음'
              : '반출 이력 없음',
            color: exports?.lastExportedAt ? 'success' : 'default'
          }
        ]}
        metadata={[
          {
            label: '반출 범위',
            value: `${formatNumber(exports?.items.length ?? 0, 0)}개`
          },
          {
            label: '대상 행 수',
            value: `${formatNumber(totalRows, 0)}행`
          },
          {
            label: '마지막 반출',
            value: formatDateTime(exports?.lastExportedAt ?? null)
          }
        ]}
        primaryActionLabel="반출 범위 보기"
        primaryActionHref="#exports-workbench"
        secondaryActionLabel="감사 로그"
        secondaryActionHref="/admin/logs"
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

      <SectionCard
        title="지금 우선 확인"
        description="운영자가 반출 전에 확인할 범위 수, 행 수, 최근 반출 시점을 먼저 보여줍니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExportInfoItem
              label="반출 범위"
              value={`${formatNumber(exports?.items.length ?? 0, 0)}개`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExportInfoItem
              label="대상 행 수"
              value={`${formatNumber(totalRows, 0)}행`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExportInfoItem
              label="마지막 반출"
              value={formatDateTime(exports?.lastExportedAt ?? null)}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="반출 작업대"
        description="실제 CSV 생성은 여기서 범위별로 실행합니다."
      >
        <Stack spacing={1.5} id="exports-workbench">
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

      <SectionCard
        title="수동 CSV 반출"
        description="자동 백업은 아직 다루지 않고, 운영자가 필요한 시점에 내려받는 1차 흐름만 제공합니다."
      >
        <Typography variant="body2" color="text.secondary">
          생성된 파일은 브라우저에서 즉시 다운로드되며, UTF-8 CSV 형식으로
          저장됩니다.
        </Typography>
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

function ExportInfoItem({ label, value }: { label: string; value: string }) {
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
