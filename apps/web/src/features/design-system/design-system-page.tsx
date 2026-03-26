'use client';

import { Grid, MenuItem, Stack, TextField } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { SummaryCard } from '@/shared/ui/summary-card';
import { TransactionForm } from '@/features/transactions/transaction-form';
import { mockTransactions } from '@/features/transactions/transactions.api';

const columns: GridColDef<(typeof mockTransactions)[number]>[] = [
  { field: 'businessDate', headerName: 'Date', flex: 0.8 },
  { field: 'title', headerName: 'Title', flex: 1.2 },
  { field: 'categoryName', headerName: 'Category', flex: 1 },
  {
    field: 'status',
    headerName: 'Status',
    flex: 0.8,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  },
  {
    field: 'amountWon',
    headerName: 'Amount',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function DesignSystemPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="UI Baseline"
        title="Design System Sample"
        description="A reference page for the shared card, table, chart, and form patterns used across features."
        primaryActionLabel="Primary Action"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="KPI 01" value={formatWon(3200000)} subtitle="Shared summary card" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="KPI 02" value={formatWon(1465000)} subtitle="Shared summary card" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="KPI 03" value={formatWon(540000)} subtitle="Shared summary card" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="KPI 04" value={formatWon(1835000)} subtitle="Shared summary card" />
        </Grid>
      </Grid>
      <SectionCard
        title="Filter Toolbar"
        description="Shared filter spacing and field rhythm for list-oriented feature pages."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Keyword" size="small" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="Type" size="small" defaultValue="ALL">
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
              <MenuItem value="EXPENSE">Expense</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Month" size="small" defaultValue="2026-03" />
          </Grid>
        </Grid>
      </SectionCard>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="Standard Table"
            description="Baseline grid presentation for feature-level tables."
            rows={mockTransactions}
            columns={columns}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ChartCard
            title="Standard Chart"
            description="Charts stay inside the same card shell used by domain pages."
            chart={
              <BarChart
                height={320}
                xAxis={[{ scaleType: 'band', data: ['Income', 'Expense', 'Recurring', 'Reserve'] }]}
                series={[{ data: [3200000, 1465000, 540000, 400000] }]}
              />
            }
          />
        </Grid>
      </Grid>
      <SectionCard title="Standard Form" description="Example form block reused by the transactions feature.">
        <TransactionForm />
      </SectionCard>
    </Stack>
  );
}
