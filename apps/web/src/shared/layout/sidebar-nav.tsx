'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Toolbar,
  Typography
} from '@mui/material';
import type { NavigationMenuItem } from '@personal-erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { resolveNavigationIcon } from '@/shared/navigation/navigation-icons';
import {
  getWorkspaceNavigationTree,
  workspaceNavigationQueryKey
} from '@/shared/navigation/workspace-navigation.api';

const drawerWidth = 304;
const EMPTY_NAVIGATION_ITEMS: NavigationMenuItem[] = [];

export function SidebarNav() {
  const pathname = usePathname() ?? '';
  const navigationQuery = useQuery({
    queryKey: workspaceNavigationQueryKey,
    queryFn: getWorkspaceNavigationTree
  });
  const items = navigationQuery.data?.items ?? EMPTY_NAVIGATION_ITEMS;
  const selectedKey = resolveSelectedNavigationKey(pathname, items);
  const activeAncestorKeys = React.useMemo(
    () => collectAncestorKeys(items, selectedKey),
    [items, selectedKey]
  );
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setOpenKeys((current) => {
      const next = new Set(current);
      let changed = false;

      if (next.size === 0) {
        for (const item of items) {
          if (activeAncestorKeys.has(item.key) || item.key === selectedKey) {
            if (!next.has(item.key)) {
              next.add(item.key);
              changed = true;
            }
          }
        }
      }

      for (const key of activeAncestorKeys) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeAncestorKeys, items, selectedKey]);

  const toggleOpen = (key: string) => {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        display: { xs: 'none', lg: 'block' },
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          borderRight: '1px solid',
          borderColor: 'divider',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))',
          overflowY: 'auto',
          boxShadow: '18px 0 50px rgba(15, 23, 42, 0.06)'
        }
      }}
      open
    >
      <Toolbar sx={{ alignItems: 'flex-start', minHeight: 96, py: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main">
            메뉴
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 850, letterSpacing: '-0.03em' }}
          >
            PERSONAL ERP
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <Box sx={{ px: 1.5, py: 2 }}>
        {navigationQuery.isLoading && items.length === 0 ? (
          <Stack spacing={1.25}>
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={42} />
            ))}
          </Stack>
        ) : null}

        {navigationQuery.error ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'warning.light',
              bgcolor: 'warning.50'
            }}
          >
            <Typography variant="subtitle2" color="warning.dark">
              메뉴를 불러오지 못했습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              API 연결 또는 메뉴 권한 설정을 확인해 주세요.
            </Typography>
          </Box>
        ) : null}

        {!navigationQuery.isLoading && items.length === 0 ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: 'divider',
              bgcolor: alpha('#ffffff', 0.72)
            }}
          >
            <Typography variant="subtitle2">표시할 메뉴가 없습니다.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              관리자 메뉴 권한에서 현재 역할에 허용된 메뉴를 확인해 주세요.
            </Typography>
          </Box>
        ) : null}

        <List disablePadding sx={{ mt: items.length > 0 ? 0 : 1 }}>
          {items.map((item) => (
            <NavigationNode
              key={item.id}
              item={item}
              openKeys={openKeys}
              selectedKey={selectedKey}
              onToggle={toggleOpen}
            />
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export const sidebarWidth = drawerWidth;

function NavigationNode({
  item,
  openKeys,
  selectedKey,
  onToggle
}: {
  item: NavigationMenuItem;
  openKeys: Set<string>;
  selectedKey: string | null;
  onToggle: (key: string) => void;
}) {
  const hasChildren = item.children.length > 0;
  const isOpen = openKeys.has(item.key);
  const selected = selectedKey === item.key;
  const isRoot = item.depth === 0;
  const Icon = resolveNavigationIcon(item.iconKey);

  return (
    <Box
      sx={{
        mb: isRoot ? 1.1 : 0.35,
        ml: isRoot ? 0 : Math.min(item.depth, 3) * 1.15
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={(theme) => ({
          borderRadius: isRoot ? 4 : 3,
          border: isRoot ? '1px solid' : '1px solid transparent',
          borderColor: isRoot
            ? alpha(theme.palette.primary.main, selected ? 0.24 : 0.1)
            : 'transparent',
          bgcolor: isRoot
            ? selected
              ? alpha(theme.palette.primary.main, 0.1)
              : alpha('#ffffff', 0.72)
            : 'transparent',
          boxShadow: isRoot ? '0 10px 24px rgba(15, 23, 42, 0.04)' : 'none'
        })}
      >
        <NodeButton
          item={item}
          selected={selected}
          isRoot={isRoot}
          icon={Icon}
          onToggle={onToggle}
        />
        {hasChildren ? (
          <IconButton
            aria-label={`${item.label} 펼치기`}
            size="small"
            onClick={() => onToggle(item.key)}
            sx={{ mr: 0.5 }}
          >
            {isOpen ? (
              <KeyboardArrowDownRoundedIcon fontSize="small" />
            ) : (
              <KeyboardArrowRightRoundedIcon fontSize="small" />
            )}
          </IconButton>
        ) : null}
      </Stack>

      {hasChildren ? (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <Box
            sx={{
              mt: 0.5,
              ml: isRoot ? 1.1 : 0.75,
              pl: 1,
              borderLeft: '1px solid',
              borderColor: 'divider'
            }}
          >
            {item.children.map((child) => (
              <NavigationNode
                key={child.id}
                item={child}
                openKeys={openKeys}
                selectedKey={selectedKey}
                onToggle={onToggle}
              />
            ))}
          </Box>
        </Collapse>
      ) : null}
    </Box>
  );
}

function NodeButton({
  item,
  selected,
  isRoot,
  icon: Icon,
  onToggle
}: {
  item: NavigationMenuItem;
  selected: boolean;
  isRoot: boolean;
  icon: React.ElementType | null;
  onToggle: (key: string) => void;
}) {
  const button = (
    <ListItemButton
      selected={selected}
      onClick={item.href ? undefined : () => onToggle(item.key)}
      sx={(theme) => ({
        flex: 1,
        minWidth: 0,
        borderRadius: isRoot ? 4 : 3,
        px: isRoot ? 1.5 : 1.2,
        py: isRoot ? 1.15 : 0.85,
        color: selected ? 'primary.main' : 'text.primary',
        '&.Mui-selected': {
          bgcolor: alpha(theme.palette.primary.main, 0.1)
        },
        '&.Mui-selected:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.14)
        }
      })}
    >
      <ListItemIcon sx={{ minWidth: isRoot ? 40 : 30 }}>
        {Icon ? (
          <Icon
            fontSize={isRoot ? 'medium' : 'small'}
            color={selected ? 'primary' : 'inherit'}
          />
        ) : (
          <RadioButtonUncheckedRoundedIcon
            sx={{
              fontSize: isRoot ? 16 : 9,
              color: selected ? 'primary.main' : 'text.disabled'
            }}
          />
        )}
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        primaryTypographyProps={{
          noWrap: true,
          variant: isRoot ? 'subtitle2' : 'body2',
          fontWeight: selected ? 800 : isRoot ? 750 : 600
        }}
      />
    </ListItemButton>
  );

  if (!item.href) {
    return button;
  }

  return (
    <Link
      href={item.href as Route}
      style={{
        flex: 1,
        minWidth: 0,
        textDecoration: 'none',
        color: 'inherit'
      }}
    >
      {button}
    </Link>
  );
}

function resolveSelectedNavigationKey(
  pathname: string,
  items: NavigationMenuItem[]
) {
  let bestMatchKey: string | null = null;
  let bestMatchLength = -1;

  for (const item of flattenNavigationItems(items)) {
    if (!item.href) {
      continue;
    }

    const isMatch =
      item.matchMode === 'EXACT'
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    if (!isMatch || item.href.length <= bestMatchLength) {
      continue;
    }

    bestMatchKey = item.key;
    bestMatchLength = item.href.length;
  }

  return bestMatchKey;
}

function collectAncestorKeys(
  items: NavigationMenuItem[],
  selectedKey: string | null
) {
  if (!selectedKey) {
    return new Set<string>();
  }

  const ancestors = new Set<string>();

  function visit(node: NavigationMenuItem, trail: string[]): boolean {
    if (node.key === selectedKey) {
      for (const key of trail) {
        ancestors.add(key);
      }
      return true;
    }

    for (const child of node.children) {
      if (visit(child, [...trail, node.key])) {
        return true;
      }
    }

    return false;
  }

  for (const item of items) {
    if (visit(item, [])) {
      break;
    }
  }

  return ancestors;
}

function flattenNavigationItems(
  items: NavigationMenuItem[]
): NavigationMenuItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenNavigationItems(item.children)
  ]);
}
