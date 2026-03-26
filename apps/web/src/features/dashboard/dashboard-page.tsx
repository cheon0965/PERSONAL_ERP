'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type { TransactionItem } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getTransactions } from '@/features/transactions/transactions.api';
import { getDashboardSummary } from './dashboard.api';

const transactionColumns: GridColDef<TransactionItem>[] = [
  { field: 'businessDate', headerName: 'Date', flex: 0.8 },
  { field: 'title', headerName: 'Title', flex: 1.3 },
  { field: 'categoryName', headerName: 'Category', flex: 1 },
  { field: 'accountName', headerName: 'Account', flex: 1 },
  {
    field: 'amountWon',
    headerName: 'Amount',
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
    queryKey: ['transactions'],
    queryFn: getTransactions
  });

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data ?? [];

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Operations Overview"
        title="Dashboard"
        description="Review the month snapshot, recurring exposure, and recent ledger movement in one place."
        primaryActionLabel="Add Transaction"
      />
      {summaryQuery.error ? (
        <QueryErrorAlert title="Dashboard summary request failed" error={summaryQuery.error} />
      ) : null}
      {transactionsQuery.error ? (
        <QueryErrorAlert title="Recent transactions request failed" error={transactionsQuery.error} />
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="Actual Balance"
            value={formatWon(summary?.actualBalanceWon ?? 0)}
            subtitle="Current cash position"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="Confirmed Expense"
            value={formatWon(summary?.confirmedExpenseWon ?? 0)}
            subtitle="Booked outflow"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="Remaining Recurring"
            value={formatWon(summary?.remainingRecurringWon ?? 0)}
            subtitle="Unposted recurring flow"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            title="Safety Surplus"
            value={formatWon(summary?.safetySurplusWon ?? 0)}
            subtitle="Buffer after baseline reserve"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <ChartCard
            title="Monthly Cash-flow Snapshot"
            description="Shared chart card pattern that can be reused across finance domains."
            chart={
              <BarChart
                height={320}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: ['Income', 'Expense', 'Recurring', 'Insurance', 'Vehicle', 'Surplus']
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
            title="Recent Transactions"
            description="Latest ledger activity from the transactions feature."
            rows={transactions}
            columns={transactionColumns}
            height={320}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
