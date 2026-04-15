'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import { Box, Tab, Tabs } from '@mui/material';

type SectionTabItem = {
  href: string;
  label: string;
  matchHrefs?: readonly string[];
  matchPrefixes?: readonly string[];
};

type SectionTabsProps = {
  items: readonly SectionTabItem[];
  ariaLabel?: string;
};

export function SectionTabs({
  items,
  ariaLabel = '화면 섹션 이동'
}: SectionTabsProps) {
  const pathname = usePathname() ?? '';
  const value = resolveSectionTabValue(pathname, items);

  return (
    <Box
      sx={{
        p: 0.75,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#f8fafc', 0.92),
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)'
      }}
    >
      <Tabs
        value={value}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label={ariaLabel}
        sx={{
          minHeight: 48,
          '& .MuiTabs-indicator': {
            display: 'none'
          },
          '& .MuiTabs-flexContainer': {
            gap: 0.75
          }
        }}
      >
        {items.map((item) => (
          <Tab
            key={item.href}
            component={Link}
            href={item.href as Route}
            value={item.href}
            label={item.label}
            sx={{
              minHeight: 40,
              px: 1.75,
              borderRadius: 999,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              alignItems: 'flex-start',
              transition: 'all 160ms ease',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                fontWeight: 700
              },
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          />
        ))}
      </Tabs>
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
      if (!pathname.startsWith(candidate) || candidate.length <= bestMatchLength) {
        continue;
      }

      bestMatchHref = item.href;
      bestMatchLength = candidate.length;
    }
  }

  return bestMatchHref;
}
