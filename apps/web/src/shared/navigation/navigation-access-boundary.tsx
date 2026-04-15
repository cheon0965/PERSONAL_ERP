'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { NavigationMenuItem } from '@personal-erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  getWorkspaceNavigationTree,
  workspaceNavigationQueryKey
} from './workspace-navigation.api';

export function NavigationAccessBoundary({
  children
}: React.PropsWithChildren) {
  const pathname = usePathname() ?? '';
  const navigationQuery = useQuery({
    queryKey: workspaceNavigationQueryKey,
    queryFn: getWorkspaceNavigationTree
  });
  const items = navigationQuery.data?.items ?? [];

  if (
    navigationQuery.isSuccess &&
    items.length > 0 &&
    !isPathAllowed(pathname, items)
  ) {
    const firstHref = findFirstHref(items) ?? '/dashboard';

    return (
      <Stack spacing={appLayout.pageGap}>
        <Alert severity="warning" variant="outlined" icon={<BlockRoundedIcon />}>
          <Typography variant="subtitle1" fontWeight={700}>
            현재 역할에 허용된 메뉴가 아닙니다.
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            이 화면은 DB 메뉴 권한에서 현재 역할에 노출되지 않도록 설정되어
            있습니다. 메뉴 권한을 조정하거나 허용된 화면으로 이동해 주세요.
          </Typography>
        </Alert>
        <div>
          <Button component={Link} href={firstHref} variant="contained">
            허용된 첫 화면으로 이동
          </Button>
        </div>
      </Stack>
    );
  }

  return <>{children}</>;
}

function isPathAllowed(pathname: string, items: NavigationMenuItem[]) {
  return flattenNavigationItems(items).some((item) => {
    if (!item.href) {
      return false;
    }

    return item.matchMode === 'EXACT'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
}

function findFirstHref(items: NavigationMenuItem[]): string | null {
  for (const item of items) {
    if (item.href) {
      return item.href;
    }

    const childHref = findFirstHref(item.children);
    if (childHref) {
      return childHref;
    }
  }

  return null;
}

function flattenNavigationItems(
  items: NavigationMenuItem[]
): NavigationMenuItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenNavigationItems(item.children)
  ]);
}
