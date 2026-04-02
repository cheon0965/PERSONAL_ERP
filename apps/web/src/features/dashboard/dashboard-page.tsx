'use client';

import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { Alert, Box, Chip, Grid, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { BarChart } from '@mui/x-charts/BarChart';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ChartCard } from '@/shared/ui/chart-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getDashboardSummary } from './dashboard.api';

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => getDashboardSummary()
  });

  useDomainHelp({
    title: '월 운영 대시보드 개요',
    description:
      '대시보드는 현재 운영 월을 기준으로 사업 현황을 요약해 보여주며, 공식 확정 수치와 운영 판단 수치를 구분해서 해석하게 돕습니다.',
    primaryEntity: '사업 장부 / 운영 월',
    relatedEntities: [
      '계획 항목',
      '전표와 전표 라인',
      '월 마감 스냅샷',
      '공식 재무제표'
    ],
    truthSource:
      '공식 수치의 단일 원천은 마감 완료된 월의 마감 스냅샷과 공식 재무제표입니다.',
    readModelNote:
      '이 화면의 카드와 추이는 운영 판단용이며, 잠금 전 기간의 값은 공식 확정치와 다를 수 있습니다.'
  });

  const summary = summaryQuery.data;
  const trend = [...(summary?.trend ?? [])].reverse();

  if (summaryQuery.error) {
    return (
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="장부 운영"
          title="월 운영 대시보드"
          description="현재 운영 월을 기준으로 사업 현황을 요약해 보여주는 화면입니다."
        />
        <QueryErrorAlert
          title="대시보드 요약 조회에 실패했습니다."
          error={summaryQuery.error}
        />
      </Stack>
    );
  }

  if (!summary) {
    return (
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="장부 운영"
          title="월 운영 대시보드"
          description="현재 운영 월을 기준으로 사업 현황을 요약해 보여주는 화면입니다."
        />
        <SectionCard
          title="운영 기간이 아직 없습니다"
          description="대시보드는 열린 운영 월이 있어야 계산됩니다."
        >
          <Typography variant="body2" color="text.secondary">
            먼저 월 운영을 시작하면 대시보드 카드와 추이를 현재 운영 월 기준으로
            계산합니다.
          </Typography>
        </SectionCard>
      </Stack>
    );
  }

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="장부 운영"
        title="월 운영 대시보드"
        description="현재 운영 월의 확정 전표, 남은 계획, 최근 공식 잠금 기준을 함께 읽어 운영 판단과 공식 보고의 경계를 분명하게 보여줍니다."
        primaryActionLabel="운영 전망 보기"
        primaryActionHref="/forecast"
      />

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
          p: appLayout.dashboardHeroPadding,
          background:
            'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(22, 101, 52, 0.9) 58%, rgba(74, 222, 128, 0.72))',
          color: 'common.white',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)'
        }}
      >
        <Stack
          spacing={appLayout.dashboardHeroMetricGap}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.2}
            alignItems={{ md: 'center' }}
          >
            <Typography
              variant="overline"
              sx={{ color: alpha('#ffffff', 0.72) }}
            >
              {summary.period.monthLabel} 운영 기간
            </Typography>
            <Chip
              label={readBasisStatusLabel(summary.basisStatus)}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                color: '#ecfeff',
                backgroundColor: alpha('#ffffff', 0.14),
                border: `1px solid ${alpha('#ffffff', 0.18)}`
              }}
            />
          </Stack>

          <Typography
            variant="h4"
            sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}
          >
            운영 숫자와 최근 공식 숫자를 같은 화면에서 분리해 확인합니다.
          </Typography>

          <Typography sx={{ maxWidth: 700, color: alpha('#ffffff', 0.78) }}>
            현재 기간 상태는 {readPeriodStatusLabel(summary.period.status)}이며,
            안전 잉여와 남은 계획 지출을 운영 판단 기준으로 보여줍니다.
          </Typography>

          {summary.officialComparison ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <MetricBadge
                label="최근 공식 순자산"
                value={formatWon(
                  summary.officialComparison.officialNetWorthWon
                )}
              />
              <MetricBadge
                label="최근 공식 손익"
                value={formatWon(
                  summary.officialComparison.officialPeriodPnLWon
                )}
              />
            </Stack>
          ) : null}
        </Stack>
      </Box>

      {summary.warnings.map((warning) => (
        <Alert key={warning} severity="warning" variant="outlined">
          {warning}
        </Alert>
      ))}

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

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
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
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="운영 해석"
            description="현재 카드가 운영 숫자인지, 최근 공식 잠금 숫자인지 같은 문맥에서 풀어 설명합니다."
          >
            <Stack spacing={1.5}>
              {summary.highlights.map((highlight) => (
                <Stack
                  key={highlight.label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                >
                  <Typography variant="body2" color="text.secondary">
                    {highlight.label}
                  </Typography>
                  <Chip
                    label={formatWon(highlight.amountWon)}
                    color={readHighlightToneColor(highlight.tone)}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              ))}

              {summary.officialComparison ? (
                <Box
                  sx={{
                    mt: 1,
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="subtitle2">
                    최근 공식 잠금 기준: {summary.officialComparison.monthLabel}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.75 }}
                  >
                    공식 현금{' '}
                    {formatWon(summary.officialComparison.officialCashWon)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    공식 순자산{' '}
                    {formatWon(summary.officialComparison.officialNetWorthWon)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    공식 손익{' '}
                    {formatWon(summary.officialComparison.officialPeriodPnLWon)}
                  </Typography>
                </Box>
              ) : null}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        minWidth: 180,
        p: 1.5,
        borderRadius: 4,
        backgroundColor: alpha('#ffffff', 0.1),
        border: `1px solid ${alpha('#ffffff', 0.12)}`
      }}
    >
      <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72) }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
        {value}
      </Typography>
    </Box>
  );
}

function readBasisStatusLabel(
  basisStatus: 'LIVE_OPERATIONS' | 'OFFICIAL_LOCKED'
) {
  return basisStatus === 'OFFICIAL_LOCKED'
    ? '공식 잠금 기준'
    : '운영 판단 기준';
}

function readPeriodStatusLabel(status: string) {
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
