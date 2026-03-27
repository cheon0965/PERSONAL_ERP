'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack, TextField } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { TransactionItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { formatWon } from '@/shared/lib/format';
import { TransactionForm } from './transaction-form';
import { getTransactions, transactionsQueryKey } from './transactions.api';

const columns: GridColDef<TransactionItem>[] = [
  { field: 'businessDate', headerName: 'Date', flex: 0.8 },
  { field: 'title', headerName: 'Title', flex: 1.4 },
  { field: 'accountName', headerName: 'Account', flex: 1 },
  { field: 'categoryName', headerName: 'Category', flex: 1 },
  { field: 'origin', headerName: 'Origin', flex: 0.8 },
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

export function TransactionsPage() {
  const { data = [], error } = useQuery({
    queryKey: transactionsQueryKey,
    queryFn: getTransactions
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Manage posted cash-flow entries separately from recurring rule definitions."
        primaryActionLabel="New Transaction"
      />
      {error ? <QueryErrorAlert title="Transaction request failed" error={error} /> : null}

      <SectionCard title="Filters" description="Reserved area for keyword, account, and category filters.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Keyword" size="small" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Account" size="small" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Category" size="small" />
          </Grid>
        </Grid>
      </SectionCard>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <DataTableCard
            title="Transaction Ledger"
            description="Posted transactions across manual and recurring origins."
            rows={data}
            columns={columns}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <SectionCard
            title="Quick Add"
            description="Keeps the input pattern close to the feature while the mutation flow is still being wired."
          >
            <TransactionForm />
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
