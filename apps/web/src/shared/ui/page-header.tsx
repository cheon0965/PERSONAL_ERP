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
        position: 'relative',
        overflow: 'hidden',
        px: appLayout.pageHeaderPadding,
        py: appLayout.pageHeaderPadding,
        borderRadius: appLayout.pageHeaderSurfaceRadius,
        border: '1px solid',
        borderColor: 'divider',
        background: `linear-gradient(160deg, ${alpha('#ffffff', 0.98)}, ${alpha('#f8fafc', 0.94)})`,
        boxShadow: '0 22px 50px rgba(15, 23, 42, 0.08)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '-30% auto auto 58%',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#60a5fa', 0.18)}, transparent 70%)`,
          pointerEvents: 'none'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: appLayout.pageHeaderSurfaceRadius,
          background: `linear-gradient(180deg, transparent, ${alpha('#e2e8f0', 0.12)})`,
          pointerEvents: 'none'
        }
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
            <Typography
              variant="overline"
              color="primary.main"
              sx={{ fontWeight: 700, letterSpacing: '0.08em' }}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Typography
            variant="h4"
            sx={{
              mt: appLayout.pageHeaderTitleOffset,
              fontWeight: 800,
              letterSpacing: '-0.03em'
            }}
          >
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
            <Stack
              key={item.label}
              spacing={0.35}
              sx={{
                minWidth: 128,
                px: 1.5,
                py: 1.1,
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha('#cbd5e1', 0.7),
                bgcolor: alpha('#ffffff', 0.72),
                backdropFilter: 'blur(10px)'
              }}
            >
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
          sx={buttonSurfaceSx}
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
        sx={buttonSurfaceSx}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      color={color}
      disabled={disabled}
      onClick={onClick}
      sx={buttonSurfaceSx}
    >
      {label}
    </Button>
  );
}

const buttonSurfaceSx = {
  borderRadius: 999,
  px: 2,
  textTransform: 'none',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  boxShadow: 'none'
} as const;
