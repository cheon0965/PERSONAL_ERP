'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Tab, Tabs } from '@mui/material';

type SectionTabItem = {
  href: Route;
  label: string;
  matchHrefs?: readonly Route[];
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
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Tabs
        value={value}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label={ariaLabel}
        sx={{ minHeight: 46 }}
      >
        {items.map((item) => (
          <Tab
            key={item.href}
            component={Link}
            href={item.href}
            value={item.href}
            label={item.label}
            sx={{
              minHeight: 46,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              alignItems: 'flex-start'
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
  }

  return bestMatchHref;
}
