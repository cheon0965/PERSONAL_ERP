'use client';

import Link from 'next/link';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography
} from '@mui/material';
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
    title: '월 운영 대시보드 사용 가이드',
    description:
      '대시보드는 월 운영 사이클 중간중간 현재 자금 상태, 확정 지출, 남은 계획, 안전 잉여를 빠르게 읽는 점검 화면입니다.',
    primaryEntity: '사업 장부 / 운영 월',
    relatedEntities: [
      '계획 항목',
      '전표와 전표 라인',
      '월 마감 스냅샷',
      '공식 재무제표'
    ],
    truthSource:
      '공식 수치의 단일 원천은 마감 완료된 월의 마감 스냅샷과 공식 재무제표입니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '상단 운영 기간과 기준 상태를 확인해 현재 화면이 열린 월 기준인지 공식 잠금 기준인지 구분합니다.',
          '현재 자금 잔액과 안전 잉여로 단기 운영 여력을 봅니다.',
          '확정 전표 지출과 남은 계획 지출을 비교해 아직 확정하지 않은 비용을 찾습니다.',
          '최근 기간 추이에서 수입, 확정 지출, 남은 계획 지출의 흐름을 확인합니다.',
          '더 자세히 판단하려면 운영 전망 보기로 이동합니다.'
        ]
      },
      {
        title: '언제 확인하나',
        items: [
          '월 운영을 연 직후 기준 상태를 빠르게 확인합니다.',
          '계획 항목 생성 후 남은 계획 지출이 반영됐는지 봅니다.',
          '수집 거래를 전표로 확정한 뒤 확정 지출이 반영됐는지 봅니다.',
          '월 마감 직전 이상 징후가 없는지 마지막으로 확인합니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면의 카드와 추이는 운영 판단용입니다. 공식 보고 숫자는 월 마감 후 재무제표 화면의 스냅샷을 기준으로 확인합니다.'
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
              <Button
                component={Link}
                href="/reference-data"
                variant="outlined"
              >
                기준 데이터 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      </Stack>
    );
  }

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="장부 운영"
        title="월 운영 대시보드"
        description="현재 운영 월의 운영 숫자와 최근 공식 숫자를 구분해 보면서 월간 판단 흐름을 빠르게 점검합니다."
        badges={[
          {
            label: `${summary.period.monthLabel} 운영 월`,
            color: 'primary'
          },
          {
            label: readBasisStatusLabel(summary.basisStatus),
            color:
              summary.basisStatus === 'OFFICIAL_LOCKED' ? 'info' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '기간 상태',
            value: readPeriodStatusLabel(summary.period.status)
          },
          {
            label: '최근 공식 비교',
            value: summary.officialComparison?.monthLabel ?? '없음'
          },
          {
            label: '주의 항목',
            value: `${summary.warnings.length}건`
          }
        ]}
        primaryActionLabel="운영 전망 보기"
        primaryActionHref="/forecast"
        secondaryActionLabel="재무제표 보기"
        secondaryActionHref="/financial-statements"
      />

      <SectionCard
        title="운영 기준선"
        description="헤더에서 월과 기준 상태를 확인한 뒤, 아래 카드와 차트는 이 기준을 따라 읽습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 4 }}>
              <DashboardInfoItem
                label="현재 운영 기간"
                value={summary.period.monthLabel}
                description={readPeriodStatusLabel(summary.period.status)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DashboardInfoItem
                label="판단 기준"
                value={readBasisStatusLabel(summary.basisStatus)}
                description="운영 숫자와 공식 잠금 숫자의 경계를 먼저 확인합니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DashboardInfoItem
                label="최근 공식 잠금"
                value={summary.officialComparison?.monthLabel ?? '없음'}
                description={
                  summary.officialComparison
                    ? '공식 재무제표와 비교 가능한 최근 잠금 월입니다.'
                    : '아직 비교 가능한 공식 잠금 기준이 없습니다.'
                }
              />
            </Grid>
          </Grid>

          {summary.officialComparison ? (
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, md: 4 }}>
                <DashboardInfoItem
                  label="공식 현금"
                  value={formatWon(summary.officialComparison.officialCashWon)}
                  description="최근 잠금 월 기준 현금 잔액입니다."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <DashboardInfoItem
                  label="공식 순자산"
                  value={formatWon(
                    summary.officialComparison.officialNetWorthWon
                  )}
                  description="운영 숫자와 비교할 공식 기준선입니다."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <DashboardInfoItem
                  label="공식 손익"
                  value={formatWon(
                    summary.officialComparison.officialPeriodPnLWon
                  )}
                  description="공식 보고서 기준 월간 손익입니다."
                />
              </Grid>
            </Grid>
          ) : null}
        </Stack>
      </SectionCard>

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

function DashboardInfoItem({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
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
