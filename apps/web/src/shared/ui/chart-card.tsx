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
    <Card sx={{ height: '100%', display: 'flex' }}>
      <CardContent sx={{ p: appLayout.cardPadding, flex: 1, width: '100%' }}>
        <Stack spacing={appLayout.cardGap} sx={{ height: '100%' }}>
          <div>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: appLayout.cardDescriptionOffset,
                  maxWidth: 720,
                  lineHeight: 1.7,
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  display: '-webkit-box'
                }}
              >
                {description}
              </Typography>
            ) : null}
          </div>
          <div>{chart}</div>
        </Stack>
      </CardContent>
    </Card>
  );
}
