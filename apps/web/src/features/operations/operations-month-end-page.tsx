'use client';

import Link from 'next/link';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  getOperationsMonthEnd,
  operationsMonthEndQueryKey
} from './operations.api';
import {
  readOperationsStatusColor,
  readOperationsStatusLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsMonthEndPage() {
  const monthEndQuery = useQuery({
    queryKey: operationsMonthEndQueryKey,
    queryFn: getOperationsMonthEnd
  });
  const monthEnd = monthEndQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="월 마감 대시보드"
        description="현재 월의 마감 가능 여부, 미확정 거래, 업로드 실패, 남은 계획, 재무제표와 차기 이월 생성 상태를 요약합니다."
        primaryActionLabel="월 운영 화면"
        primaryActionHref="/periods"
      />

      <OperationsSectionNav />

      {monthEndQuery.error ? (
        <QueryErrorAlert
          title="월 마감 요약을 불러오지 못했습니다."
          error={monthEndQuery.error}
        />
      ) : null}

      <Alert
        severity={monthEnd?.closeReadiness === 'READY' ? 'success' : 'warning'}
        variant="outlined"
      >
        {monthEnd?.closeReadinessLabel ?? '월 마감 상태를 계산하는 중입니다.'}
      </Alert>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="마감 상태"
            value={readOperationsStatusLabel(monthEnd?.closeReadiness ?? 'INFO')}
            subtitle={monthEnd?.period?.monthLabel ?? '운영 기간 없음'}
            tone={monthEnd?.closeReadiness === 'READY' ? 'success' : 'warning'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="미확정 거래"
            value={formatNumber(monthEnd?.unresolvedTransactionCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="남은 계획 지출"
            value={formatWon(monthEnd?.remainingPlannedExpenseWon ?? 0)}
            tone="neutral"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="업로드 실패 행"
            value={formatNumber(monthEnd?.failedImportRowCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="마감 차단 사유" description="마감 전 반드시 처리해야 할 항목입니다.">
            <Stack spacing={1.25}>
              {(monthEnd?.blockers ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  현재 마감 차단 사유가 없습니다.
                </Typography>
              ) : null}
              {(monthEnd?.blockers ?? []).map((blocker) => (
                <Alert key={blocker} severity="error" variant="outlined">
                  {blocker}
                </Alert>
              ))}
              <Button component={Link} href="/operations/exceptions" variant="outlined">
                예외 처리함 보기
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="마감 전 경고" description="차단은 아니지만 운영자가 확인해야 할 항목입니다.">
            <Stack spacing={1.25}>
              {(monthEnd?.warnings ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  현재 추가 경고가 없습니다.
                </Typography>
              ) : null}
              {(monthEnd?.warnings ?? []).map((warning) => (
                <Alert key={warning} severity="warning" variant="outlined">
                  {warning}
                </Alert>
              ))}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  label={`재무제표 ${formatNumber(monthEnd?.financialStatementSnapshotCount ?? 0, 0)}개`}
                  color={readOperationsStatusColor(
                    (monthEnd?.financialStatementSnapshotCount ?? 0) > 0
                      ? 'READY'
                      : 'INFO'
                  )}
                />
                <Chip
                  label={monthEnd?.carryForwardCreated ? '차기 이월 생성됨' : '차기 이월 확인 필요'}
                  color={monthEnd?.carryForwardCreated ? 'success' : 'info'}
                />
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
