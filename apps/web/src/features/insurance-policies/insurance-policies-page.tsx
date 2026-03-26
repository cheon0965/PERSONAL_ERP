'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getInsurancePolicies } from './insurance-policies.api';

const columns: GridColDef<InsurancePolicyItem>[] = [
  { field: 'provider', headerName: 'Provider', flex: 1 },
  { field: 'productName', headerName: 'Product', flex: 1.4 },
  {
    field: 'monthlyPremiumWon',
    headerName: 'Premium',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  },
  { field: 'paymentDay', headerName: 'Pay Day', flex: 0.7 },
  { field: 'cycle', headerName: 'Cycle', flex: 0.8 },
  {
    field: 'renewalDate',
    headerName: 'Renewal',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  }
];

export function InsurancePoliciesPage() {
  const { data = [], error } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: getInsurancePolicies
  });
  const totalPremium = data.reduce((acc, item) => acc + item.monthlyPremiumWon, 0);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Fixed Cost Domain"
        title="Insurance Policies"
        description="Track policies as recurring fixed-cost commitments that affect planning and liquidity."
        primaryActionLabel="Add Policy"
      />
      {error ? <QueryErrorAlert title="Insurance policy request failed" error={error} /> : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard title="Monthly Premium" value={formatWon(totalPremium)} subtitle="Total recurring premium" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard title="Policy Count" value={String(data.length)} subtitle="Managed contracts" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard title="Renewal Queue" value="1" subtitle="Upcoming renewal count" />
        </Grid>
      </Grid>
      <DataTableCard
        title="Policy List"
        description="Planning-focused fields only, without deep underwriting detail."
        rows={data}
        columns={columns}
      />
    </Stack>
  );
}
