'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Tab, Tabs } from '@mui/material';

const referenceDataSectionItems = [
  {
    href: '/reference-data',
    label: '준비 상태와 관리 범위'
  },
  {
    href: '/reference-data/manage',
    label: '기준 데이터 관리'
  }
] as const;

export function ReferenceDataSectionNav() {
  const pathname = usePathname();
  const value =
    pathname === '/reference-data/manage'
      ? '/reference-data/manage'
      : '/reference-data';

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
        sx={{ minHeight: 44 }}
      >
        {referenceDataSectionItems.map((item) => (
          <Tab
            key={item.href}
            component={Link}
            href={item.href}
            value={item.href}
            label={item.label}
            sx={{
              minHeight: 44,
              textTransform: 'none',
              alignItems: 'flex-start'
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
