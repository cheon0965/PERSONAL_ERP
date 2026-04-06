'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Button, Stack, Typography } from '@mui/material';

const referenceDataSectionItems = [
  {
    href: '/reference-data',
    label: '준비 상태와 관리 범위',
    description: 'readiness, ownership, 운영 영향 범위를 먼저 확인합니다.'
  },
  {
    href: '/reference-data/manage',
    label: '기준 데이터 관리',
    description: '자금수단, 카테고리, 참조 기준값을 조회하고 관리합니다.'
  }
] as const;

export function ReferenceDataSectionNav() {
  const pathname = usePathname();

  return (
    <Box
      sx={{
        p: 1,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        {referenceDataSectionItems.map((item) => {
          const selected = pathname === item.href;

          return (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              variant={selected ? 'contained' : 'text'}
              color={selected ? 'primary' : 'inherit'}
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 3,
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                textTransform: 'none'
              }}
            >
              <Stack
                spacing={0.5}
                alignItems="flex-start"
                sx={{ width: '100%' }}
              >
                <Typography
                  variant="subtitle2"
                  color="inherit"
                  textAlign="left"
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="body2"
                  color={selected ? 'inherit' : 'text.secondary'}
                  textAlign="left"
                  sx={{ opacity: selected ? 0.88 : 1 }}
                >
                  {item.description}
                </Typography>
              </Stack>
            </Button>
          );
        })}
      </Stack>
    </Box>
  );
}
