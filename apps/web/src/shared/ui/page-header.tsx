'use client';

import Link from 'next/link';
import { Box, Button, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionOnClick?: () => void;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  primaryActionLabel,
  primaryActionHref,
  primaryActionOnClick
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      gap={appLayout.pageHeaderGap}
    >
      <Box sx={{ maxWidth: appLayout.pageHeaderContentMaxWidth }}>
        {eyebrow ? (
          <Typography variant="overline" color="text.secondary">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h4" sx={{ mt: appLayout.pageHeaderTitleOffset }}>
          {title}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mt: appLayout.pageHeaderDescriptionOffset }}
        >
          {description}
        </Typography>
      </Box>

      {primaryActionLabel && (primaryActionHref || primaryActionOnClick) ? (
        primaryActionHref ? (
          <Button component={Link} href={primaryActionHref} variant="contained">
            {primaryActionLabel}
          </Button>
        ) : (
          <Button variant="contained" onClick={primaryActionOnClick}>
            {primaryActionLabel}
          </Button>
        )
      ) : null}
    </Stack>
  );
}
