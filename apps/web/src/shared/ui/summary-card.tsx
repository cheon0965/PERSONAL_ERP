'use client';

import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { Card, CardContent, Stack, Typography } from '@mui/material';

type SummaryCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

export function SummaryCard({ title, value, subtitle }: SummaryCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <TrendingUpRoundedIcon color="primary" fontSize="small" />
          </Stack>
          <Typography variant="h5">{value}</Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
