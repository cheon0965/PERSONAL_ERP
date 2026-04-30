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
import { alpha } from '@mui/material/styles';
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
  metadataSingleRow?: boolean;
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
        minWidth: 0,
        overflow: 'hidden',
        px: appLayout.pageHeaderPadding,
        py: appLayout.pageHeaderPadding,
        borderRadius: `${brandTokens.radius.lg}px`,
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primaryBright, 0.14),
        color: brandTokens.palette.text,
        backgroundColor: brandTokens.palette.surface,
        boxShadow: brandTokens.shadow.card,
        isolation: 'isolate',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto auto 0',
          width: { xs: 7, md: 9 },
          height: '100%',
          backgroundColor: alpha(brandTokens.palette.primaryBright, 0.58),
          opacity: 1
        },
        '& > *': {
          position: 'relative',
          zIndex: 1
        }
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-start' }}
        gap={appLayout.pageHeaderGap}
        sx={{ minWidth: 0 }}
      >
        <Stack
          gap={0.75}
          sx={{
            minWidth: 0,
            maxWidth: appLayout.pageHeaderContentMaxWidth,
            width: '100%',
            flex: 1
          }}
        >
          {eyebrow ? (
            <Typography
              variant="caption"
              sx={{
                color: brandTokens.palette.primary,
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
                letterSpacing: 0,
                color: brandTokens.palette.text,
                overflowWrap: 'anywhere'
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
          {description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: appLayout.pageHeaderDescriptionOffset,
                maxWidth: 760,
                lineHeight: 1.75,
                overflowWrap: 'anywhere'
              }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>

        {hasActions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={appLayout.pageHeaderActionGap}
            useFlexGap
            flexWrap={{ xs: 'nowrap', sm: 'wrap' }}
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
            sx={{
              width: { xs: '100%', md: 'auto' },
              alignSelf: { xs: 'stretch', md: 'flex-start' },
              minWidth: 0
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
  flex: { xs: '0 0 auto', sm: '0 0 auto' },
  width: { xs: '100%', sm: 'auto' },
  minWidth: 0,
  maxWidth: '100%',
  borderRadius: 999,
  minHeight: 36,
  px: 1.65,
  textTransform: 'none',
  fontWeight: 800,
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  lineHeight: 1.25,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  boxShadow: 'none'
} as const;
