'use client';

import Link from 'next/link';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type { DashboardSummary } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';

export function DashboardEmptyState() {
  return (
    <SectionCard
      title="운영 기간이 아직 없습니다"
      description="대시보드는 열린 운영 월이 있어야 계산됩니다."
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          먼저 월 운영을 시작하면 대시보드 카드와 추이를 현재 운영 월 기준으로
          계산합니다.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          useFlexGap
          flexWrap="wrap"
        >
          <Button component={Link} href="/periods" variant="contained">
            운영 월 보기
          </Button>
          <Button component={Link} href="/reference-data" variant="outlined">
            기준 데이터 보기
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

export function DashboardSummarySections({
  summary
}: {
  summary: DashboardSummary;
}) {
  const trend = [...summary.trend].reverse();

  return (
    <>
      {summary.warnings.length > 0 ? (
        <Alert severity="warning" variant="outlined">
          <Stack spacing={0.5}>
            {summary.warnings.map((warning) => (
              <Typography key={warning} variant="body2">
                {warning}
              </Typography>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="운영 기준"
            title="현재 자금 잔액"
            value={formatWon(summary.actualBalanceWon)}
            subtitle="입출금 계정 기준 현재 잔액 또는 마감된 월의 공식 현금 잔액입니다."
            tone="primary"
            icon={AccountBalanceWalletRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="전표 기준"
            title="확정 전표 지출"
            value={formatWon(summary.confirmedExpenseWon)}
            subtitle="현재 선택한 월에 확정 처리된 전표 지출 합계입니다."
            tone="warning"
            icon={ReceiptLongRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="계획 기준"
            title="남은 계획 지출"
            value={formatWon(summary.remainingPlannedExpenseWon)}
            subtitle="아직 실제 거래나 전표로 이어지지 않은 계획 지출만 집계합니다."
            tone="neutral"
            icon={AutoGraphRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="안전 기준"
            title="안전 잉여"
            value={formatWon(summary.safetySurplusWon)}
            subtitle={`최소 예비자금 ${formatWon(summary.minimumReserveWon)} 반영 후 남는 운영 여력입니다.`}
            tone="success"
            icon={ShieldRoundedIcon}
          />
        </Grid>
      </Grid>

      <SectionCard
        title="빠른 체크포인트"
        description="대시보드는 세부 해석보다 지금 바로 확인할 포인트만 짧게 보여주고, 자세한 판단은 전망과 보고 화면으로 넘깁니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          {summary.highlights.map((highlight) => (
            <Grid key={highlight.label} size={{ xs: 12, sm: 'grow' }}>
              <Stack
                spacing={0.75}
                sx={{
                  p: appLayout.cardPadding,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.default',
                  height: '100%'
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {highlight.label}
                </Typography>
                <Typography variant="h6">
                  {formatWon(highlight.amountWon)}
                </Typography>
                <Chip
                  label={readHighlightToneLabel(highlight.tone)}
                  color={readHighlightToneColor(highlight.tone)}
                  variant="outlined"
                  size="small"
                  sx={{ width: 'fit-content' }}
                />
              </Stack>
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <ChartCard
        title="최근 기간 추이"
        description="수입, 확정 지출, 남은 계획 지출을 현재 운영 월 기준으로 함께 보여줍니다."
        chart={
          <BarChart
            height={320}
            xAxis={[
              {
                scaleType: 'band',
                data: trend.map((item) => item.monthLabel)
              }
            ]}
            series={[
              {
                label: '수입',
                data: trend.map((item) => item.incomeWon)
              },
              {
                label: '확정 지출',
                data: trend.map((item) => item.expenseWon)
              },
              {
                label: '남은 계획 지출',
                data: trend.map((item) => item.plannedExpenseWon)
              }
            ]}
          />
        }
      />
    </>
  );
}

export function readBasisStatusLabel(
  basisStatus: 'LIVE_OPERATIONS' | 'OFFICIAL_LOCKED'
) {
  return basisStatus === 'OFFICIAL_LOCKED'
    ? '공식 잠금 기준'
    : '운영 판단 기준';
}

export function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'OPEN':
      return '열린 기간';
    case 'IN_REVIEW':
      return '검토 중인 기간';
    case 'CLOSING':
      return '마감 진행 중인 기간';
    case 'LOCKED':
      return '잠금된 기간';
    default:
      return status;
  }
}

function readHighlightToneColor(tone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL') {
  switch (tone) {
    case 'POSITIVE':
      return 'success';
    case 'NEGATIVE':
      return 'warning';
    default:
      return 'default';
  }
}

function readHighlightToneLabel(tone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL') {
  switch (tone) {
    case 'POSITIVE':
      return '긍정 신호';
    case 'NEGATIVE':
      return '점검 필요';
    default:
      return '중립';
  }
}
