'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { brandTokens } from '@/shared/theme/tokens';

type SectionTabItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
  matchHrefs?: readonly string[];
  matchPrefixes?: readonly string[];
};

type SectionTabsProps = {
  items: readonly SectionTabItem[];
  ariaLabel?: string;
};

type SegmentedTabItem<TValue extends string> = {
  value: TValue;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type SegmentedTabsProps<TValue extends string> = {
  items: readonly SegmentedTabItem<TValue>[];
  value: TValue;
  ariaLabel?: string;
  onChange: (value: TValue) => void;
};

export function SectionTabs({
  items,
  ariaLabel = '화면 섹션 이동'
}: SectionTabsProps) {
  const pathname = usePathname() ?? '';
  const value = resolveSectionTabValue(pathname, items);

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      sx={{
        p: 0.6,
        borderRadius: 3.25,
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primaryBright, 0.14),
        background: `linear-gradient(180deg, ${alpha(
          brandTokens.palette.surface,
          0.96
        )}, ${alpha(brandTokens.palette.primaryTint, 0.9)})`,
        boxShadow: '0 10px 24px rgba(6, 34, 111, 0.06)'
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: resolveTabGridColumns(items.length),
          gap: 0.65
        }}
      >
        {items.map((item, index) => (
          <ButtonBase
            key={`section-tab-${index}-${item.href}-${item.label}`}
            component={Link}
            href={item.href as Route}
            aria-current={value === item.href ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            focusRipple
            sx={createTabButtonSx(value === item.href)}
          >
            <TabButtonContent item={item} selected={value === item.href} />
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

export function SegmentedTabs<TValue extends string>({
  items,
  value,
  ariaLabel = '화면 탭 선택',
  onChange
}: SegmentedTabsProps<TValue>) {
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        p: 0.6,
        borderRadius: 3.25,
        border: '1px solid',
        borderColor: alpha(brandTokens.palette.primaryBright, 0.14),
        background: `linear-gradient(180deg, ${alpha(
          brandTokens.palette.surface,
          0.96
        )}, ${alpha(brandTokens.palette.primaryTint, 0.9)})`
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: resolveTabGridColumns(items.length),
          gap: 0.65
        }}
      >
        {items.map((item) => {
          const selected = value === item.value;

          return (
            <ButtonBase
              key={item.value}
              role="tab"
              type="button"
              disabled={item.disabled}
              aria-selected={selected}
              aria-label={item.label}
              title={item.label}
              focusRipple
              onClick={() => {
                onChange(item.value);
              }}
              sx={createTabButtonSx(selected, item.disabled)}
            >
              <TabButtonContent item={item} selected={selected} />
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

function resolveSectionTabValue(
  pathname: string,
  items: readonly SectionTabItem[]
): string | false {
  let bestMatchHref: string | false = false;
  let bestMatchLength = -1;

  for (const item of items) {
    for (const candidate of [item.href, ...(item.matchHrefs ?? [])]) {
      const isMatch =
        pathname === candidate || pathname.startsWith(`${candidate}/`);

      if (!isMatch || candidate.length <= bestMatchLength) {
        continue;
      }

      bestMatchHref = item.href;
      bestMatchLength = candidate.length;
    }

    for (const candidate of item.matchPrefixes ?? []) {
      if (
        !pathname.startsWith(candidate) ||
        candidate.length <= bestMatchLength
      ) {
        continue;
      }

      bestMatchHref = item.href;
      bestMatchLength = candidate.length;
    }
  }

  return bestMatchHref;
}

function TabButtonContent({
  item,
  selected
}: {
  item: Pick<SectionTabItem, 'label' | 'shortLabel' | 'icon'>;
  selected: boolean;
}) {
  return (
    <Stack
      component="span"
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{ minWidth: 0, width: '100%' }}
    >
      {item.icon ? (
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            flexShrink: 0,
            color: selected ? 'primary.contrastText' : 'text.secondary'
          }}
        >
          {item.icon}
        </Box>
      ) : null}
      <Typography
        component="span"
        variant="body2"
        sx={{
          minWidth: 0,
          fontWeight: selected ? 800 : 700,
          lineHeight: 1.2,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2
        }}
      >
        {item.shortLabel ?? item.label}
      </Typography>
    </Stack>
  );
}

function resolveTabGridColumns(itemCount: number) {
  const mobileColumns = itemCount <= 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))';
  const minimumWidth = itemCount > 6 ? 112 : itemCount > 4 ? 124 : 140;

  return {
    xs: mobileColumns,
    sm: `repeat(auto-fit, minmax(${minimumWidth}px, 1fr))`
  } as const;
}

function createTabButtonSx(selected: boolean, disabled = false) {
  return (theme: Theme) => ({
    minWidth: 0,
    width: '100%',
    minHeight: { xs: 40, md: 42 },
    px: { xs: 1, md: 1.25 },
    py: 0.85,
    borderRadius: 2.35,
    justifyContent: 'flex-start',
    textAlign: 'left',
    textDecoration: 'none',
    border: '1px solid',
    borderColor: selected
      ? alpha(brandTokens.palette.primaryBright, 0.48)
      : 'transparent',
    color: selected
      ? theme.palette.primary.contrastText
      : theme.palette.text.primary,
    background: selected ? brandTokens.gradient.brand : 'transparent',
    boxShadow: selected
      ? `0 10px 20px ${alpha(brandTokens.palette.primaryBright, 0.16)}`
      : 'none',
    transition:
      'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
    opacity: disabled ? 0.48 : 1,
    '&:hover': {
      backgroundColor: selected
        ? undefined
        : alpha(theme.palette.text.primary, 0.045),
      borderColor: selected
        ? alpha(brandTokens.palette.secondary, 0.7)
        : brandTokens.palette.border
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${alpha(theme.palette.primary.main, 0.58)}`,
      outlineOffset: 2
    }
  });
}
