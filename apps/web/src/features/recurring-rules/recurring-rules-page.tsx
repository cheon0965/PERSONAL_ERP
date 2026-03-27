'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { RecurringRuleItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { RecurringRuleForm } from './recurring-rule-form';
import { getRecurringRules, recurringRulesQueryKey } from './recurring-rules.api';

const columns: GridColDef<RecurringRuleItem>[] = [
  { field: 'title', headerName: 'Title', flex: 1.2 },
  {
    field: 'amountWon',
    headerName: 'Amount',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  },
  { field: 'frequency', headerName: 'Frequency', flex: 0.8 },
  {
    field: 'nextRunDate',
    headerName: 'Next Run',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  { field: 'accountName', headerName: 'Account', flex: 1 },
  { field: 'categoryName', headerName: 'Category', flex: 1 },
  {
    field: 'isActive',
    headerName: 'Active',
    flex: 0.7,
    renderCell: (params) => <StatusChip label={params.value ? 'ACTIVE' : 'CANCELLED'} />
  }
];

export function RecurringRulesPage() {
  const { data = [], error } = useQuery({
    queryKey: recurringRulesQueryKey,
    queryFn: getRecurringRules
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Rules"
        title="Recurring Rules"
        description="Keep rule definitions separate from posted transactions so scheduling stays auditable."
        primaryActionLabel="Add Rule"
      />
      {error ? <QueryErrorAlert title="Recurring rule request failed" error={error} /> : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <DataTableCard
            title="Recurring Payment Rules"
            description="Each rule is the source of future cash-flow events, not the event itself."
            rows={data}
            columns={columns}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <SectionCard
            title="Quick Add"
            description="Create a recurring rule without leaving the rules workspace."
          >
            <RecurringRuleForm />
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
