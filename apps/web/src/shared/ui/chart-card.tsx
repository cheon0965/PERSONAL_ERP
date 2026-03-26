'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';

type ChartCardProps = {
  title: string;
  description?: string;
  chart: React.ReactNode;
};

export function ChartCard({ title, description, chart }: ChartCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {description}
              </Typography>
            ) : null}
          </div>
          {chart}
        </Stack>
      </CardContent>
    </Card>
  );
}
