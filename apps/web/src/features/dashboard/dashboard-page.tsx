'use client';

import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { alpha } from '@mui/material/styles';
import { Box, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getCollectedTransactions } from '@/features/transactions/transactions.api';
import { getDashboardSummary } from './dashboard.api';

const transactionColumns: GridColDef<CollectedTransactionItem>[] = [
  { field: 'businessDate', headerName: '거래일', flex: 0.8 },
  { field: 'title', headerName: '적요', flex: 1.3 },
  { field: 'categoryName', headerName: '카테고리', flex: 1 },
  { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
  {
    field: 'amountWon',
    headerName: '금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary
  });
  const transactionsQuery = useQuery({
    queryKey: ['collected-transactions'],
    queryFn: getCollectedTransactions
  });

  useDomainHelp({
    title: '월 운영 대시보드 개요',
    description:
      '대시보드는 장부 전체를 직접 수정하는 화면이 아니라, 현재 운영 기간의 요약과 해석을 제공하는 화면입니다.',
    primaryEntity: '장부 / 운영 기간 (Ledger / AccountingPeriod)',
    relatedEntities: [
      '수집 거래 (CollectedTransaction)',
      '전표 (JournalEntry / JournalLine)',
      '마감 스냅샷 (ClosingSnapshot)',
      '재무제표 스냅샷 (FinancialStatementSnapshot)'
    ],
    truthSource: '공식 수치와 회계적 단일 원천은 확정 전표와 잠금 이후 스냅샷에 둡니다.',
    readModelNote:
      '현재 카드와 표는 운영 판단을 돕는 요약 화면이며, 회계 진실 자체를 직접 편집하는 화면이 아닙니다.'
  });

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data ?? [];

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="장부 운영"
        title="월 운영 대시보드"
        description="이 화면은 Ledger와 AccountingPeriod 기준의 읽기 모델입니다. 월 운영 판단은 여기서 빠르게 보고, 공식 회계 확정은 전표와 스냅샷을 기준으로 해석합니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionHref="/transactions#collected-transaction-form"
      />

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
          p: appLayout.dashboardHeroPadding,
          background:
            'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.92) 62%, rgba(59, 130, 246, 0.86))',
          color: 'common.white',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 'auto -10% -50% auto',
            width: { xs: 180, md: 260 },
            height: { xs: 180, md: 260 },
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)'
          }
        }}
      >
        <Grid container spacing={appLayout.dashboardHeroGap} alignItems="center">
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={appLayout.dashboardHeroMetricGap} sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="overline" sx={{ color: alpha('#ffffff', 0.72) }}>
                운영 기간 스냅샷
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                이번 장부의 월 운영 흐름을 빠르게 점검하세요.
              </Typography>
              <Typography sx={{ maxWidth: 620, color: alpha('#ffffff', 0.76) }}>
                확정 전표 기준 수입과 지출, 아직 남아 있는 계획 지출, 안전 잉여를 한 번에
                확인할 수 있도록 핵심 수치 영역을 정리했습니다.
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Grid
              container
              spacing={appLayout.dashboardHeroMetricGap}
              sx={{ position: 'relative', zIndex: 1 }}
            >
              <Grid size={{ xs: 6 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 4,
                    backgroundColor: alpha('#ffffff', 0.1),
                    border: `1px solid ${alpha('#ffffff', 0.12)}`
                  }}
                >
                  <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72) }}>
                    확정 전표 수입
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {formatWon(summary?.confirmedIncomeWon ?? 0)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 4,
                    backgroundColor: alpha('#ffffff', 0.1),
                    border: `1px solid ${alpha('#ffffff', 0.12)}`
                  }}
                >
                  <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72) }}>
                    기간말 예상
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                    {formatWon(summary?.expectedMonthEndBalanceWon ?? 0)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>

      {summaryQuery.error ? (
        <QueryErrorAlert title="대시보드 요약 조회에 실패했습니다." error={summaryQuery.error} />
      ) : null}
      {transactionsQuery.error ? (
        <QueryErrorAlert
          title="최근 운영 흐름 조회에 실패했습니다."
          error={transactionsQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="FundingAccount 기준"
            title="현재 자금 잔액"
            value={formatWon(summary?.actualBalanceWon ?? 0)}
            subtitle="자금수단(FundingAccount) 읽기 모델을 집계한 현재 잔액입니다."
            tone="primary"
            icon={AccountBalanceWalletRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="전표 기준"
            title="확정 전표 지출"
            value={formatWon(summary?.confirmedExpenseWon ?? 0)}
            subtitle="이미 JournalEntry로 확정되어 장부에 반영된 월간 지출 합계입니다."
            tone="warning"
            icon={ReceiptLongRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="계획 기준"
            title="남은 계획 지출"
            value={formatWon(summary?.remainingRecurringWon ?? 0)}
            subtitle="RecurringRule과 PlanItem에서 아직 확정되지 않은 예정 지출입니다."
            tone="neutral"
            icon={AutorenewRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="안전 여력"
            title="안전 잉여"
            value={formatWon(summary?.safetySurplusWon ?? 0)}
            subtitle="최소 예비자금을 반영한 뒤 남는 운영 여력입니다."
            tone="success"
            icon={ShieldRoundedIcon}
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <ChartCard
            title="장부 월 운영 요약"
            description="확정 전표 지출과 계획 지출, 보조 운영 비용이 어떤 비중으로 움직이는지 빠르게 확인할 수 있습니다."
            chart={
              <BarChart
                height={320}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: ['수입', '지출', '반복', '보험', '차량', '잉여']
                  }
                ]}
                series={[
                  {
                    data: [
                      summary?.confirmedIncomeWon ?? 0,
                      summary?.confirmedExpenseWon ?? 0,
                      summary?.remainingRecurringWon ?? 0,
                      summary?.insuranceMonthlyWon ?? 0,
                      summary?.vehicleMonthlyWon ?? 0,
                      summary?.safetySurplusWon ?? 0
                    ]
                  }
                ]}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <DataTableCard
            title="최근 확정 흐름"
            description="수집 거래가 확정되어 장부에 반영된 최근 흐름을 요약한 읽기 모델입니다."
            rows={transactions}
            columns={transactionColumns}
            height={320}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
