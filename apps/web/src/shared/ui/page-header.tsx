'use client';

import { Box, Button, Stack, Typography } from '@mui/material';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  primaryActionLabel
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      gap={2}
    >
      <Box>
        {eyebrow ? (
          <Typography variant="overline" color="text.secondary">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h4" sx={{ mt: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      </Box>

      {primaryActionLabel ? <Button variant="contained">{primaryActionLabel}</Button> : null}
    </Stack>
  );
}
