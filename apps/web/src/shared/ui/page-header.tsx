'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import {
  Button,
  Chip,
  Stack,
  Typography,
  type ButtonProps,
  type ChipProps
} from '@mui/material';
import { brandTokens } from '../theme/tokens';
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
  badges = [],
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
        borderRadius: `${brandTokens.radius.lg}px`,
        border: '1px solid',
        borderColor: brandTokens.palette.border,
        color: brandTokens.palette.text,
        backgroundColor: brandTokens.palette.surface,
        boxShadow: brandTokens.shadow.card,
        isolation: 'isolate',
        '& > *': {
          position: 'relative',
          zIndex: 1
        }
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
        gap={appLayout.pageHeaderGap}
      >
        <Stack
          gap={0.75}
          sx={{
            minWidth: 0,
            maxWidth: appLayout.pageHeaderContentMaxWidth
          }}
        >
          {eyebrow ? (
            <Typography
              variant="caption"
              sx={{
                color: brandTokens.palette.textMuted,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={appLayout.pageHeaderBadgeGap}
            useFlexGap
            flexWrap="wrap"
          >
            <Typography
              component="h1"
              variant="h5"
              sx={{
                mt: appLayout.pageHeaderTitleOffset,
                fontWeight: 800,
                fontSize: { xs: '1.35rem', md: '1.55rem' },
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                color: brandTokens.palette.text
              }}
            >
              {title}
            </Typography>
            {badges.length > 0 ? (
              <Stack
                direction="row"
                spacing={appLayout.pageHeaderBadgeGap}
                useFlexGap
                flexWrap="wrap"
              >
                {badges.map((badge, index) => (
                  <Chip
                    key={`badge-${index}-${String(badge.label)}`}
                    label={badge.label}
                    color={badge.color ?? 'default'}
                    variant={badge.variant ?? 'outlined'}
                    size="small"
                    sx={{
                      borderRadius: 999,
                      '& .MuiChip-label': {
                        px: 1.1,
                        fontWeight: 700
                      }
                    }}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Stack>

        {hasActions ? (
          <Stack
            direction="row"
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
          size="small"
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
        size="small"
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
      size="small"
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
  minHeight: 34,
  px: 1.5,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  boxShadow: 'none'
} as const;
