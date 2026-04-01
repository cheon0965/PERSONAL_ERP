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
    <Card>
      <CardContent sx={{ p: appLayout.cardPadding }}>
        <Stack spacing={appLayout.cardGap}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: appLayout.cardDescriptionOffset }}
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
