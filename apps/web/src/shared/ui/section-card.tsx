'use client';

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: appLayout.cardPadding }}>
        <Stack spacing={appLayout.cardGap}>
          <Box>
            <Typography variant="h6">{title}</Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
