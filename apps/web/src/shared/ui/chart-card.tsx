'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from './layout-metrics';

type ChartCardProps = {
  title: string;
  description?: string;
  chart: React.ReactNode;
  chartMinWidth?: number | string;
};

export function ChartCard({
  title,
  description,
  chart,
  chartMinWidth = 0
}: ChartCardProps) {
  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        minWidth: 0,
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
      <CardContent
        sx={{ p: appLayout.cardPadding, flex: 1, width: '100%', minWidth: 0 }}
      >
        <Stack spacing={appLayout.cardGap} sx={{ height: '100%', minWidth: 0 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
              {title}
            </Typography>
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
                  display: '-webkit-box',
                  overflowWrap: 'anywhere'
                }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              overflowX: 'auto',
              overflowY: 'hidden',
              pb: 0.5
            }}
          >
            <Box sx={{ width: '100%', minWidth: chartMinWidth }}>{chart}</Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
