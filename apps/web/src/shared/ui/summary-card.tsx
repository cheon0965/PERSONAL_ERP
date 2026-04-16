'use client';

import type { ElementType } from 'react';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
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
    accent: '#0f172a',
    iconColor: '#0f172a',
    iconBackground: alpha('#0f172a', 0.08),
    badgeBackground: alpha('#0f172a', 0.06),
    badgeColor: '#334155',
    glowColor: alpha('#0f172a', 0.08)
  },
  primary: {
    accent: '#2563eb',
    iconColor: '#2563eb',
    iconBackground: alpha('#2563eb', 0.12),
    badgeBackground: alpha('#2563eb', 0.08),
    badgeColor: '#1d4ed8',
    glowColor: alpha('#2563eb', 0.12)
  },
  success: {
    accent: '#15803d',
    iconColor: '#15803d',
    iconBackground: alpha('#15803d', 0.12),
    badgeBackground: alpha('#15803d', 0.08),
    badgeColor: '#166534',
    glowColor: alpha('#15803d', 0.12)
  },
  warning: {
    accent: '#d97706',
    iconColor: '#d97706',
    iconBackground: alpha('#d97706', 0.14),
    badgeBackground: alpha('#d97706', 0.1),
    badgeColor: '#b45309',
    glowColor: alpha('#d97706', 0.12)
  }
};

export function SummaryCard({
  title,
  value,
  eyebrow,
  tone = 'neutral',
  icon: Icon = TrendingUpRoundedIcon
}: SummaryCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96))',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto auto 0',
          width: '100%',
          height: 4,
          background: `linear-gradient(90deg, ${toneStyle.accent}, ${alpha(toneStyle.accent, 0.2)})`
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
      <CardContent sx={{ p: appLayout.cardPadding }}>
        <Stack spacing={appLayout.cardGap}>
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
                borderRadius: 3,
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
        </Stack>
      </CardContent>
    </Card>
  );
}
