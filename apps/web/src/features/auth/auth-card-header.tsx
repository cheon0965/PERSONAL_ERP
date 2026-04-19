'use client';

import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

type AuthCardHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  trailing?: ReactNode;
};

export function AuthCardHeader({
  eyebrow,
  title,
  description,
  aside,
  trailing
}: AuthCardHeaderProps) {
  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={1.5}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          {eyebrow ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.35rem', md: '1.6rem' },
              lineHeight: 1.15,
              letterSpacing: '-0.03em'
            }}
          >
            {title}
          </Typography>
          {description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.7 }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>

        {aside ? (
          <Box sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}>
            {aside}
          </Box>
        ) : null}
      </Stack>

      {trailing ? <Box>{trailing}</Box> : null}
    </Stack>
  );
}
