'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type ChartCardProps = {
  title: string;
  description?: string;
  chart: React.ReactNode;
};

export function ChartCard({ title, description, chart }: ChartCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: appLayout.cardPadding }}>
        <Stack spacing={appLayout.cardGap}>
          <div>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: appLayout.cardDescriptionOffset,
                  display: 'block',
                  maxWidth: 720,
                  lineHeight: 1.7
                }}
              >
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
