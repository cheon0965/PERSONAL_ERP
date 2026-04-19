'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  children
}: SectionCardProps) {
  return (
    <Card sx={{ height: '100%', display: 'flex' }}>
      <CardContent sx={{ p: appLayout.cardPadding, flex: 1, width: '100%' }}>
        <Stack spacing={appLayout.cardGap} sx={{ height: '100%' }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: appLayout.cardDescriptionOffset,
                  maxWidth: 760,
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
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
