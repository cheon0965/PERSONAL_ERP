'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  type ButtonProps,
  type ChipProps
} from '@mui/material';
import { appLayout } from './layout-metrics';

type PageHeaderBadge = {
  label: ReactNode;
  color?: ChipProps['color'];
  variant?: ChipProps['variant'];
};

type PageHeaderMetadataItem = {
  label: string;
  value: ReactNode;
};

type PageHeaderHref = Route | `#${string}`;

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  badges?: PageHeaderBadge[];
  metadata?: PageHeaderMetadataItem[];
  primaryActionLabel?: string;
  primaryActionHref?: PageHeaderHref;
  primaryActionOnClick?: () => void;
  primaryActionDisabled?: boolean;
  primaryActionColor?: ButtonProps['color'];
  secondaryActionLabel?: string;
  secondaryActionHref?: PageHeaderHref;
  secondaryActionOnClick?: () => void;
  secondaryActionDisabled?: boolean;
  secondaryActionColor?: ButtonProps['color'];
};

export function PageHeader({
  eyebrow,
  title,
  description,
  badges = [],
  metadata = [],
  primaryActionLabel,
  primaryActionHref,
  primaryActionOnClick,
  primaryActionDisabled,
  primaryActionColor,
  secondaryActionLabel,
  secondaryActionHref,
  secondaryActionOnClick,
  secondaryActionDisabled,
  secondaryActionColor
}: PageHeaderProps) {
  const hasActions =
    (primaryActionLabel && (primaryActionHref || primaryActionOnClick)) ||
    (secondaryActionLabel && (secondaryActionHref || secondaryActionOnClick));

  return (
    <Stack
      direction="column"
      gap={appLayout.pageHeaderGap}
      sx={{
        px: appLayout.pageHeaderPadding,
        py: appLayout.pageHeaderPadding,
        borderRadius: appLayout.pageHeaderSurfaceRadius,
        border: '1px solid',
        borderColor: 'divider',
        background: `linear-gradient(180deg, ${alpha('#ffffff', 0.98)}, ${alpha('#f8fafc', 0.96)})`
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'center' }}
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
          {description ? (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mt: appLayout.pageHeaderDescriptionOffset }}
            >
              {description}
            </Typography>
          ) : null}

          {badges.length > 0 ? (
            <Stack
              direction="row"
              spacing={appLayout.pageHeaderBadgeGap}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: description ? 2 : 1.5 }}
            >
              {badges.map((badge) => (
                <Chip
                  key={String(badge.label)}
                  label={badge.label}
                  color={badge.color ?? 'default'}
                  variant={badge.variant ?? 'outlined'}
                  size="small"
                />
              ))}
            </Stack>
          ) : null}
        </Box>

        {hasActions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={appLayout.pageHeaderActionGap}
            useFlexGap
            flexWrap="wrap"
            sx={{
              width: { xs: '100%', lg: 'auto' },
              alignSelf: { xs: 'stretch', lg: 'flex-start' }
            }}
          >
            {renderActionButton({
              label: secondaryActionLabel,
              href: secondaryActionHref,
              onClick: secondaryActionOnClick,
              disabled: secondaryActionDisabled,
              color: secondaryActionColor,
              variant: 'outlined'
            })}
            {renderActionButton({
              label: primaryActionLabel,
              href: primaryActionHref,
              onClick: primaryActionOnClick,
              disabled: primaryActionDisabled,
              color: primaryActionColor,
              variant: 'contained'
            })}
          </Stack>
        ) : null}
      </Stack>

      {metadata.length > 0 ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={appLayout.pageHeaderMetaGap}
          useFlexGap
          flexWrap="wrap"
        >
          {metadata.map((item) => (
            <Stack key={item.label} spacing={0.35} sx={{ minWidth: 128 }}>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {item.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function renderActionButton({
  label,
  href,
  onClick,
  disabled,
  color = 'primary',
  variant
}: {
  label?: string;
  href?: PageHeaderHref;
  onClick?: () => void;
  disabled?: boolean;
  color?: ButtonProps['color'];
  variant: ButtonProps['variant'];
}) {
  if (!label || !(href || onClick)) {
    return null;
  }

  if (href) {
    if (href.startsWith('#')) {
      return (
        <Button
          component="a"
          href={href}
          variant={variant}
          color={color}
          disabled={disabled}
        >
          {label}
        </Button>
      );
    }

    return (
      <Button
        component={Link}
        href={href}
        variant={variant}
        color={color}
        disabled={disabled}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button variant={variant} color={color} disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
