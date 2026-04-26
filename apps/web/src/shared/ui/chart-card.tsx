'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from './layout-metrics';

type ChartCardProps = {
  title: string;
  description?: string;
  chart: React.ReactNode;
};

export function ChartCard({ title, description, chart }: ChartCardProps) {
  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: `linear-gradient(90deg, ${alpha(
            brandTokens.palette.secondary,
            0.76
          )}, ${alpha(brandTokens.palette.primaryBright, 0.56)}, transparent)`
        }
      }}
    >
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
