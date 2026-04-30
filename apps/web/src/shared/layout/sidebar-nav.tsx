'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
import { useAuthSession } from '@/shared/auth/auth-provider';
import { BrandLogo } from '@/shared/brand/brand-logo';
import { resolveNavigationIcon } from '@/shared/navigation/navigation-icons';
import { brandTokens } from '@/shared/theme/tokens';
import {
  getWorkspaceNavigationTree,
  workspaceNavigationQueryKey
} from '@/shared/navigation/workspace-navigation.api';

const drawerWidth = 304;
const EMPTY_NAVIGATION_ITEMS: NavigationMenuItem[] = [];
const SYSTEM_ADMIN_MENU_ROLES: NavigationMenuItem['allowedRoles'] = ['OWNER'];

type SidebarNavProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function SidebarNav({
  mobileOpen = false,
  onMobileClose
}: SidebarNavProps) {
  const pathname = usePathname() ?? '';
  const { user } = useAuthSession();
  const isSystemAdmin = user?.isSystemAdmin === true;
  const hasWorkspaceContext = Boolean(user?.currentWorkspace?.ledger);
  const workspaceRole = user?.currentWorkspace?.membership.role ?? null;
  const canReadWorkspaceAdminMenu =
    workspaceRole === 'OWNER' || workspaceRole === 'MANAGER';
  const shouldLoadWorkspaceNavigation = !isSystemAdmin || hasWorkspaceContext;
  const navigationQuery = useQuery({
    queryKey: workspaceNavigationQueryKey,
    queryFn: getWorkspaceNavigationTree,
    enabled: shouldLoadWorkspaceNavigation
  });
  const platformItems = isSystemAdmin
    ? buildSystemAdminNavigationItems({
        canReadNavigation: canReadWorkspaceAdminMenu,
        canReadPolicy: canReadWorkspaceAdminMenu
      })
    : EMPTY_NAVIGATION_ITEMS;
  const workspaceItems = shouldLoadWorkspaceNavigation
    ? (navigationQuery.data?.items ?? EMPTY_NAVIGATION_ITEMS)
    : EMPTY_NAVIGATION_ITEMS;
  const items = isSystemAdmin
    ? [...platformItems, ...workspaceItems]
    : workspaceItems;
  const selectedKey = resolveSelectedNavigationKey(pathname, items);
  const activeAncestorKeys = React.useMemo(
    () => collectAncestorKeys(items, selectedKey),
    [items, selectedKey]
  );
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(new Set());
  const [manuallyClosedKeys, setManuallyClosedKeys] = React.useState<
    Set<string>
  >(new Set());
  const previousPathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    setManuallyClosedKeys(new Set());
    onMobileClose?.();
  }, [onMobileClose, pathname]);

  React.useEffect(() => {
    setOpenKeys((current) => {
      const next = new Set(current);
      let changed = false;

      if (next.size === 0) {
        for (const item of items) {
          if (
            (activeAncestorKeys.has(item.key) || item.key === selectedKey) &&
            !manuallyClosedKeys.has(item.key)
          ) {
            if (!next.has(item.key)) {
              next.add(item.key);
              changed = true;
            }
          }
        }
      }

      for (const key of activeAncestorKeys) {
        if (manuallyClosedKeys.has(key)) {
          continue;
        }

        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeAncestorKeys, items, manuallyClosedKeys, selectedKey]);

  const toggleOpen = (key: string) => {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        setManuallyClosedKeys((closedKeys) => {
          const nextClosedKeys = new Set(closedKeys);
          nextClosedKeys.add(key);
          return nextClosedKeys;
        });
      } else {
        next.add(key);
        setManuallyClosedKeys((closedKeys) => {
          const nextClosedKeys = new Set(closedKeys);
          nextClosedKeys.delete(key);
          return nextClosedKeys;
        });
      }
      return next;
    });
  };

  const drawerContent = (
    <>
      <Toolbar
        sx={{
          minHeight: { xs: 60, md: 64 },
          p: 0,
          justifyContent: 'space-between'
        }}
      >
        <Box
          component={Link}
          href={'/dashboard' as Route}
          onClick={onMobileClose}
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            minWidth: 0,
            minHeight: { xs: 60, md: 64 },
            pl: 1.5,
            pr: 1.25,
            textDecoration: 'none',
            color: 'text.primary'
          }}
        >
          <BrandLogo priority sx={{ width: { xs: 180, md: 192 } }} />
        </Box>
        <IconButton
          aria-label="메뉴 닫기"
          size="small"
          onClick={onMobileClose}
          sx={{
            display: { xs: 'inline-flex', lg: 'none' },
            mr: 1,
            flexShrink: 0
          }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ px: 1.5, py: 2 }}>
        {navigationQuery.isLoading &&
        workspaceItems.length === 0 &&
        !isSystemAdmin ? (
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
              borderColor: alpha(brandTokens.palette.warning, 0.28),
              bgcolor: alpha(brandTokens.palette.warningSoft, 0.8)
            }}
          >
            <Typography variant="subtitle2" color="warning.dark">
              {isSystemAdmin
                ? '사업장 운영 메뉴를 불러오지 못했습니다.'
                : '메뉴를 불러오지 못했습니다.'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isSystemAdmin
                ? '플랫폼 관리 메뉴는 계속 사용할 수 있습니다. 현재 사업장 문맥과 메뉴 권한 설정을 확인해 주세요.'
                : '서비스 연결 또는 메뉴 권한 설정을 확인해 주세요.'}
            </Typography>
          </Box>
        ) : null}

        {!navigationQuery.isLoading && !isSystemAdmin && items.length === 0 ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: alpha(brandTokens.palette.primaryBright, 0.18),
              bgcolor: alpha(brandTokens.palette.surface, 0.78)
            }}
          >
            <Typography variant="subtitle2">표시할 메뉴가 없습니다.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              관리자 메뉴 권한에서 현재 역할에 허용된 메뉴를 확인해 주세요.
            </Typography>
          </Box>
        ) : null}

        {platformItems.length > 0 ? (
          <SidebarSectionLabel
            title="플랫폼 관리"
            sx={{ mt: items.length > 0 ? 0 : 1 }}
          />
        ) : null}

        <List disablePadding sx={{ mt: platformItems.length > 0 ? 0.75 : 0 }}>
          {platformItems.map((item) => (
            <NavigationNode
              key={item.id}
              item={item}
              openKeys={openKeys}
              selectedKey={selectedKey}
              onToggle={toggleOpen}
              onNavigate={onMobileClose}
            />
          ))}
        </List>

        {isSystemAdmin ? (
          <SidebarSectionLabel
            title="사업장 운영"
            sx={{ mt: platformItems.length > 0 ? 2 : 0 }}
          />
        ) : null}

        {isSystemAdmin && !hasWorkspaceContext ? (
          <Box
            sx={{
              mt: 0.75,
              p: 2,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: alpha(brandTokens.palette.primaryBright, 0.18),
              bgcolor: alpha(brandTokens.palette.surface, 0.78)
            }}
          >
            <Typography variant="subtitle2">사업장 운영 문맥 없음</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              현재 연결된 사업장과 장부가 없어 일반 업무 메뉴를 표시하지
              않습니다. 테스트나 운영 확인은 사업장 멤버십이 연결된 문맥에서
              진행할 수 있습니다.
            </Typography>
          </Box>
        ) : null}

        {isSystemAdmin && hasWorkspaceContext && navigationQuery.isLoading ? (
          <Stack spacing={1.25} sx={{ mt: 0.75 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={38} />
            ))}
          </Stack>
        ) : null}

        {isSystemAdmin &&
        hasWorkspaceContext &&
        !navigationQuery.isLoading &&
        !navigationQuery.error &&
        workspaceItems.length === 0 ? (
          <Box
            sx={{
              mt: 0.75,
              p: 2,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: alpha(brandTokens.palette.primaryBright, 0.18),
              bgcolor: alpha(brandTokens.palette.surface, 0.78)
            }}
          >
            <Typography variant="subtitle2">
              표시할 사업장 운영 메뉴가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              현재 문맥 역할 기준으로 노출되는 일반 업무 메뉴가 없거나 메뉴
              권한에서 숨김 처리된 상태입니다.
            </Typography>
          </Box>
        ) : null}

        <List
          disablePadding
          sx={{
            mt:
              isSystemAdmin && workspaceItems.length > 0
                ? 0.75
                : platformItems.length === 0 && items.length > 0
                  ? 0
                  : 1
          }}
        >
          {workspaceItems.map((item) => (
            <NavigationNode
              key={item.id}
              item={item}
              openKeys={openKeys}
              selectedKey={selectedKey}
              onToggle={toggleOpen}
              onNavigate={onMobileClose}
            />
          ))}
        </List>
      </Box>
    </>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: 'none', lg: 'block' },
          '& .MuiDrawer-paper': sidebarPaperSx
        }}
        open
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            ...sidebarPaperSx,
            width: { xs: 'min(88vw, 304px)', md: 336 },
            borderBottomLeftRadius: 0,
            boxShadow: '18px 0 42px rgba(6, 34, 111, 0.18)'
          }
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

const sidebarPaperSx = {
  width: drawerWidth,
  boxSizing: 'border-box',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 24,
  borderBottomRightRadius: 24,
  borderRight: '1px solid',
  borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
  backgroundColor: brandTokens.palette.surface,
  overflowY: 'auto',
  boxShadow: '14px 0 36px rgba(6, 34, 111, 0.06)'
} as const;

export const sidebarWidth = drawerWidth;

function buildSystemAdminNavigationItems(input: {
  canReadNavigation: boolean;
  canReadPolicy: boolean;
}): NavigationMenuItem[] {
  const children: NavigationMenuItem[] = [
    {
      id: 'system-admin-home',
      key: 'system-admin-home',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '관리자 허브',
      description: '전체 관리 시작 화면입니다.',
      href: '/admin',
      iconKey: 'admin',
      matchMode: 'EXACT',
      sortOrder: 10,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-users',
      key: 'system-admin-users',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '전체 사용자 관리',
      description: '계정 상태와 세션, 전체 관리자 권한을 관리합니다.',
      href: '/admin/users',
      iconKey: 'workspace',
      matchMode: 'PREFIX',
      sortOrder: 20,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-tenants',
      key: 'system-admin-tenants',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '사업장 관리',
      description: '사업장 상태와 기본 장부 구성을 확인합니다.',
      href: '/admin/tenants',
      iconKey: 'settings',
      matchMode: 'PREFIX',
      sortOrder: 30,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-support-context',
      key: 'system-admin-support-context',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '사업장 전환 / 지원 모드',
      description: '전체 관리자 세션의 사업장 운영 문맥을 선택합니다.',
      href: '/admin/support-context',
      iconKey: 'admin',
      matchMode: 'PREFIX',
      sortOrder: 40,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-members',
      key: 'system-admin-members',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '전체 회원 관리',
      description: '모든 사업장의 멤버를 관리합니다.',
      href: '/admin/members',
      iconKey: 'workspace',
      matchMode: 'PREFIX',
      sortOrder: 50,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-security-threats',
      key: 'system-admin-security-threats',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '보안 위협 로그',
      description: '비정상 인증과 보안 위협 이벤트를 조회합니다.',
      href: '/admin/security-threats',
      iconKey: 'reports',
      matchMode: 'PREFIX',
      sortOrder: 60,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    ...(input.canReadNavigation
      ? [
          {
            id: 'system-admin-navigation',
            key: 'system-admin-navigation',
            parentId: 'system-admin-root',
            itemType: 'PAGE' as const,
            label: '메뉴 / 권한 관리',
            description:
              '현재 사업장 문맥 기준으로 메뉴 구조와 허용 역할을 관리합니다.',
            href: '/admin/navigation',
            iconKey: 'settings',
            matchMode: 'PREFIX' as const,
            sortOrder: 80,
            depth: 1,
            isVisible: true,
            allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
            children: []
          }
        ]
      : []),
    ...(input.canReadPolicy
      ? [
          {
            id: 'system-admin-policy',
            key: 'system-admin-policy',
            parentId: 'system-admin-root',
            itemType: 'PAGE' as const,
            label: '권한 정책 요약',
            description:
              '현재 사업장 문맥 기준으로 화면별 허용 역할과 노출 상태를 확인합니다.',
            href: '/admin/policy',
            iconKey: 'reports',
            matchMode: 'PREFIX' as const,
            sortOrder: 90,
            depth: 1,
            isVisible: true,
            allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
            children: []
          }
        ]
      : []),
    {
      id: 'system-admin-logs',
      key: 'system-admin-logs',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '로그관리',
      description: '모든 사업장의 감사 로그를 조회합니다.',
      href: '/admin/logs',
      iconKey: 'reports',
      matchMode: 'PREFIX',
      sortOrder: 70,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    },
    {
      id: 'system-admin-operations',
      key: 'system-admin-operations',
      parentId: 'system-admin-root',
      itemType: 'PAGE',
      label: '운영 상태',
      description: '전체 관리자 운영 점검 지표를 확인합니다.',
      href: '/admin/operations',
      iconKey: 'reports',
      matchMode: 'PREFIX',
      sortOrder: 75,
      depth: 1,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: []
    }
  ];

  return [
    {
      id: 'system-admin-root',
      key: 'system-admin-root',
      parentId: null,
      itemType: 'GROUP',
      label: '전체 관리자',
      description: null,
      href: null,
      iconKey: 'admin',
      matchMode: 'PREFIX',
      sortOrder: 10,
      depth: 0,
      isVisible: true,
      allowedRoles: SYSTEM_ADMIN_MENU_ROLES,
      children: [...children].sort(
        (left, right) => left.sortOrder - right.sortOrder
      )
    }
  ];
}

function SidebarSectionLabel({ title, sx }: { title: string; sx?: object }) {
  return (
    <Box sx={sx}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: alpha(brandTokens.palette.primary, 0.74)
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

function NavigationNode({
  item,
  openKeys,
  selectedKey,
  onToggle,
  onNavigate
}: {
  item: NavigationMenuItem;
  openKeys: Set<string>;
  selectedKey: string | null;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
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
        sx={{
          borderRadius: isRoot ? 4 : 3,
          border: isRoot ? '1px solid' : '1px solid transparent',
          borderColor: isRoot
            ? selected
              ? brandTokens.palette.borderStrong
              : brandTokens.palette.border
            : 'transparent',
          backgroundColor: isRoot
            ? selected
              ? brandTokens.palette.surfaceMuted
              : brandTokens.palette.surface
            : 'transparent',
          boxShadow: isRoot ? '0 8px 18px rgba(11, 23, 61, 0.04)' : 'none'
        }}
      >
        <NodeButton
          item={item}
          selected={selected}
          isRoot={isRoot}
          icon={Icon}
          onToggle={onToggle}
          onNavigate={onNavigate}
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
              borderColor: brandTokens.palette.border
            }}
          >
            {item.children.map((child) => (
              <NavigationNode
                key={child.id}
                item={child}
                openKeys={openKeys}
                selectedKey={selectedKey}
                onToggle={onToggle}
                onNavigate={onNavigate}
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
  onToggle,
  onNavigate
}: {
  item: NavigationMenuItem;
  selected: boolean;
  isRoot: boolean;
  icon: React.ElementType | null;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
}) {
  const button = (
    <ListItemButton
      selected={selected}
      onClick={item.href ? onNavigate : () => onToggle(item.key)}
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        borderRadius: isRoot ? 4 : 3,
        px: isRoot ? 1.5 : 1.2,
        pr: selected ? (isRoot ? 2.25 : 1.95) : isRoot ? 1.5 : 1.2,
        py: isRoot ? 1.15 : 0.85,
        color: selected ? brandTokens.palette.primaryDark : 'text.primary',
        '&.Mui-selected': {
          bgcolor: alpha('#0b173d', 0.045),
          boxShadow: `inset 3px 0 0 ${brandTokens.palette.primaryBright}`
        },
        '&.Mui-selected::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          right: 8,
          width: 4,
          height: isRoot ? 26 : 20,
          borderRadius: 999,
          backgroundColor: brandTokens.palette.primaryBright,
          transform: 'translateY(-50%)',
          boxShadow: `0 0 0 3px ${alpha(brandTokens.palette.primaryBright, 0.12)}`
        },
        '&.Mui-selected:hover': {
          bgcolor: alpha('#0b173d', 0.065)
        },
        '&:hover': {
          bgcolor: alpha('#0b173d', 0.035)
        }
      }}
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
