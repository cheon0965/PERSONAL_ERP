'use client';

import type { ElementType } from 'react';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from './layout-metrics';

type SummaryCardTone = 'neutral' | 'primary' | 'success' | 'warning';

type SummaryCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  eyebrow?: string;
  tone?: SummaryCardTone;
  icon?: ElementType;
};

const toneStyles: Record<
  SummaryCardTone,
  {
    accent: string;
    iconColor: string;
    iconBackground: string;
    badgeBackground: string;
    badgeColor: string;
    glowColor: string;
  }
> = {
  neutral: {
    accent: brandTokens.palette.primary,
    iconColor: brandTokens.palette.primary,
    iconBackground: alpha(brandTokens.palette.primaryBright, 0.1),
    badgeBackground: alpha(brandTokens.palette.primaryBright, 0.07),
    badgeColor: brandTokens.palette.textMuted,
    glowColor: alpha(brandTokens.palette.primaryBright, 0.1)
  },
  primary: {
    accent: brandTokens.palette.primaryBright,
    iconColor: brandTokens.palette.primaryBright,
    iconBackground: alpha(brandTokens.palette.primaryBright, 0.12),
    badgeBackground: alpha(brandTokens.palette.primaryBright, 0.1),
    badgeColor: brandTokens.palette.primary,
    glowColor: alpha(brandTokens.palette.primaryBright, 0.14)
  },
  success: {
    accent: brandTokens.palette.secondary,
    iconColor: brandTokens.palette.secondaryDark,
    iconBackground: alpha(brandTokens.palette.secondary, 0.16),
    badgeBackground: alpha(brandTokens.palette.secondary, 0.12),
    badgeColor: brandTokens.palette.secondaryDark,
    glowColor: alpha(brandTokens.palette.secondary, 0.18)
  },
  warning: {
    accent: brandTokens.palette.warning,
    iconColor: brandTokens.palette.warning,
    iconBackground: alpha(brandTokens.palette.warning, 0.14),
    badgeBackground: alpha(brandTokens.palette.warning, 0.1),
    badgeColor: brandTokens.palette.warning,
    glowColor: alpha(brandTokens.palette.warning, 0.12)
  }
};

export function SummaryCard({
  title,
  value,
  subtitle,
  eyebrow,
  tone = 'neutral',
  icon: Icon = TrendingUpRoundedIcon
}: SummaryCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        borderColor: alpha(toneStyle.accent, 0.16),
        background: `radial-gradient(circle at 100% 0%, ${toneStyle.glowColor}, transparent 34%), ${brandTokens.gradient.card}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto auto 0',
          width: '100%',
          height: 5,
          background: `linear-gradient(90deg, ${toneStyle.accent}, ${alpha(
            brandTokens.palette.secondary,
            0.72
          )}, ${alpha(toneStyle.accent, 0.08)})`
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: -32,
          right: -24,
          width: 128,
          height: 128,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${toneStyle.glowColor} 0%, rgba(255,255,255,0) 70%)`,
          pointerEvents: 'none'
        }
      }}
    >
      <CardContent sx={{ p: appLayout.cardPadding, flex: 1, width: '100%' }}>
        <Stack
          spacing={appLayout.cardGap}
          sx={{ height: '100%', justifyContent: 'space-between' }}
        >
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={appLayout.fieldGap}
          >
            <Stack spacing={1}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  px: 1.1,
                  py: 0.5,
                  borderRadius: 999,
                  backgroundColor: toneStyle.badgeBackground,
                  color: toneStyle.badgeColor
                }}
              >
                <Typography variant="caption" fontWeight={700}>
                  {eyebrow ?? '핵심 지표'}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {title}
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                borderRadius: 3.25,
                border: '1px solid',
                borderColor: alpha(toneStyle.accent, 0.18),
                backgroundColor: toneStyle.iconBackground,
                color: toneStyle.iconColor
              }}
            >
              <Icon fontSize="small" />
            </Box>
          </Stack>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em'
            }}
          >
            {value}
          </Typography>
          {subtitle ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: -1,
                lineHeight: 1.6,
                overflow: 'hidden',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                display: '-webkit-box'
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
