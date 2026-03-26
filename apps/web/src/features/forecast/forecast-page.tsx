'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, List, ListItem, ListItemText, Stack } from '@mui/material';
import { formatWon } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getForecast } from './forecast.api';

export function ForecastPage() {
  const { data, error } = useQuery({
    queryKey: ['forecast', '2026-03'],
    queryFn: () => getForecast('2026-03')
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Forecast"
        title="Month-end Forecast"
        description="Project the month-end buffer from confirmed data and conservative planning assumptions."
      />
      {error ? <QueryErrorAlert title="Forecast request failed" error={error} /> : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="Actual Balance" value={formatWon(data?.actualBalanceWon ?? 0)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="Remaining Recurring" value={formatWon(data?.remainingRecurringWon ?? 0)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="Expected Month End"
            value={formatWon(data?.expectedMonthEndBalanceWon ?? 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="Safety Surplus" value={formatWon(data?.safetySurplusWon ?? 0)} />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Calculation Basis"
            description="The MVP forecast keeps the formula intentionally simple and reviewable."
          >
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemText primary="Actual Balance" secondary={formatWon(data?.actualBalanceWon ?? 0)} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Confirmed Expense"
                  secondary={formatWon(data?.confirmedExpenseWon ?? 0)}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Remaining Recurring"
                  secondary={formatWon(data?.remainingRecurringWon ?? 0)}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="Sinking Fund" secondary={formatWon(data?.sinkingFundWon ?? 0)} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Minimum Reserve"
                  secondary={formatWon(data?.minimumReserveWon ?? 0)}
                />
              </ListItem>
            </List>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Notes" description="Unsupported assumptions stay explicit instead of being hidden in formulas.">
            <List disablePadding>
              {(data?.notes ?? []).map((note) => (
                <ListItem key={note} disableGutters>
                  <ListItemText primary={note} />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
