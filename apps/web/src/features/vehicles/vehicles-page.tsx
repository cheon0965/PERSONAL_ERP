'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type { FuelLogItem } from '@personal-erp/contracts';
import { formatDate, formatNumber, formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getVehicles } from './vehicles.api';

const fuelColumns: GridColDef<FuelLogItem>[] = [
  {
    field: 'filledOn',
    headerName: 'Filled On',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'odometerKm',
    headerName: 'Odometer',
    flex: 1,
    valueFormatter: (value) => `${formatNumber(Number(value))} km`
  },
  {
    field: 'liters',
    headerName: 'Liters',
    flex: 0.8,
    valueFormatter: (value) => `${formatNumber(Number(value), 3)} L`
  },
  {
    field: 'unitPriceWon',
    headerName: 'Unit Price',
    flex: 1,
    valueFormatter: (value) => `${formatNumber(Number(value))} KRW/L`
  },
  {
    field: 'amountWon',
    headerName: 'Amount',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function VehiclesPage() {
  const { data = [], error } = useQuery({ queryKey: ['vehicles'], queryFn: getVehicles });
  const vehicle = data[0];

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Vehicle Domain"
        title="Vehicles"
        description="Treat vehicles as a separate operating cost domain instead of a generic transport bucket."
        primaryActionLabel="Add Vehicle"
      />
      {error ? <QueryErrorAlert title="Vehicle request failed" error={error} /> : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="Monthly Vehicle Cost"
            value={formatWon(vehicle?.monthlyExpenseWon ?? 0)}
            subtitle="Fuel, maintenance, and fixed cost"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="Estimated Efficiency"
            value={
              vehicle?.estimatedFuelEfficiencyKmPerLiter
                ? `${formatNumber(vehicle.estimatedFuelEfficiencyKmPerLiter)} km/L`
                : '-'
            }
            subtitle="Derived from fuel log history"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard title="Vehicle" value={vehicle?.name ?? '-'} subtitle={vehicle?.fuelType ?? ''} />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ChartCard
            title="Fuel Cost Trend"
            description="Fuel cost remains close to the domain feature rather than a generic analytics folder."
            chart={
              <BarChart
                height={320}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: (vehicle?.fuelLogs ?? []).map((log) => log.filledOn.slice(5))
                  }
                ]}
                series={[
                  {
                    data: (vehicle?.fuelLogs ?? []).map((log) => log.amountWon)
                  }
                ]}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="Fuel Logs"
            description="Efficiency should be computed only from contiguous, trustworthy fuel entries."
            rows={vehicle?.fuelLogs ?? []}
            columns={fuelColumns}
            height={320}
          />
        </Grid>
      </Grid>
      {vehicle ? (
        <Typography variant="body2" color="text.secondary">
          Clear separation between measured data and estimated metrics keeps the vehicle domain easier to extend.
        </Typography>
      ) : null}
    </Stack>
  );
}
