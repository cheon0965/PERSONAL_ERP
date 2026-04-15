'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import {
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  Stack,
  Switch,
  Typography
} from '@mui/material';
import type {
  NavigationMenuItem,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { resolveNavigationIcon } from '@/shared/navigation/navigation-icons';
import { workspaceNavigationQueryKey } from '@/shared/navigation/workspace-navigation.api';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  adminNavigationQueryKey,
  adminPolicyQueryKey,
  getAdminNavigationTree,
  updateAdminNavigationItem
} from './admin.api';
import { readMembershipRoleLabel } from './admin-labels';
import { AdminSectionNav } from './admin-section-nav';

const menuRoles: TenantMembershipRole[] = [
  'OWNER',
  'MANAGER',
  'EDITOR',
  'VIEWER'
];

type NavigationDraft = {
  isVisible: boolean;
  allowedRoles: TenantMembershipRole[];
};

type FlatNavigationItem = NavigationMenuItem & {
  parentTrail: string[];
};

export function AdminNavigationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadNavigation = role === 'OWNER' || role === 'MANAGER';
  const canUpdateNavigation = role === 'OWNER';
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, NavigationDraft>>(
    {}
  );

  const navigationQuery = useQuery({
    queryKey: adminNavigationQueryKey,
    queryFn: getAdminNavigationTree,
    enabled: canReadNavigation
  });
  const items = navigationQuery.data?.items ?? [];
  const rows = React.useMemo(() => flattenNavigationTree(items), [items]);
  const summary = React.useMemo(() => summarizeNavigation(rows), [rows]);

  const updateMutation = useMutation({
    mutationFn: (input: { item: NavigationMenuItem; draft: NavigationDraft }) =>
      updateAdminNavigationItem(input.item.id, input.draft),
    onSuccess: async (_response, variables) => {
      setFeedback(`${variables.item.label} 메뉴 권한을 저장했습니다.`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.item.id];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminNavigationQueryKey }),
        queryClient.invalidateQueries({ queryKey: workspaceNavigationQueryKey }),
        queryClient.invalidateQueries({ queryKey: adminPolicyQueryKey })
      ]);
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '메뉴 권한 저장에 실패했습니다.'
      );
    }
  });

  const readDraft = React.useCallback(
    (item: NavigationMenuItem): NavigationDraft =>
      drafts[item.id] ?? {
        isVisible: item.isVisible,
        allowedRoles: item.allowedRoles
      },
    [drafts]
  );

  const updateDraft = (
    item: NavigationMenuItem,
    updater: (draft: NavigationDraft) => NavigationDraft
  ) => {
    setDrafts((current) => ({
      ...current,
      [item.id]: updater(readDraft(item))
    }));
  };

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="메뉴 / 권한 관리"
        description="사이드바 트리 메뉴를 DB 기준으로 관리하고, 메뉴별 허용 역할을 조정합니다."
        badges={[
          {
            label: canReadNavigation ? 'DB 메뉴 조회 가능' : '조회 권한 필요',
            color: canReadNavigation ? 'success' : 'warning'
          },
          {
            label: canUpdateNavigation ? '소유자 편집 가능' : '조회 전용',
            color: canUpdateNavigation ? 'primary' : 'default'
          }
        ]}
        metadata={[
          { label: '현재 역할', value: readMembershipRoleLabel(role) },
          { label: '전체 메뉴', value: `${summary.totalCount}개` },
          { label: '페이지 메뉴', value: `${summary.pageCount}개` },
          { label: '숨김 메뉴', value: `${summary.hiddenCount}개` }
        ]}
        primaryActionLabel="권한 정책 보기"
        primaryActionHref="/admin/policy"
      />

      <AdminSectionNav />

      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}

      {!canReadNavigation ? (
        <Alert severity="warning" variant="outlined">
          메뉴 권한 관리는 소유자 또는 관리자 권한에서 조회할 수 있습니다. 현재
          권한은 {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      {navigationQuery.error ? (
        <QueryErrorAlert
          title="메뉴 권한 정보를 불러오지 못했습니다."
          error={navigationQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 3 }}>
          <MenuMetric label="트리 그룹" value={`${summary.groupCount}개`} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MenuMetric label="책임 분리 메뉴" value={`${summary.restrictedCount}개`} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MenuMetric label="모든 역할 허용" value={`${summary.allRoleCount}개`} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MenuMetric label="저장 대기" value={`${Object.keys(drafts).length}개`} />
        </Grid>
      </Grid>

      <SectionCard
        title="DB 메뉴 권한 트리"
        description="상위 메뉴를 숨기거나 역할을 줄이면 하위 메뉴도 함께 노출되지 않습니다. 실제 화면 접근도 이 트리 기준으로 한 번 더 막습니다."
      >
        <Stack spacing={1.25}>
          {rows.map((item) => {
            const draft = readDraft(item);
            const dirty = isDraftDirty(item, draft);

            return (
              <MenuPermissionRow
                key={item.id}
                item={item}
                draft={draft}
                dirty={dirty}
                canUpdate={canUpdateNavigation}
                isSaving={updateMutation.isPending}
                onVisibleChange={(isVisible) =>
                  updateDraft(item, (current) => ({
                    ...current,
                    isVisible
                  }))
                }
                onRoleToggle={(candidate) => {
                  updateDraft(item, (current) => {
                    const hasRole = current.allowedRoles.includes(candidate);
                    const nextRoles = hasRole
                      ? current.allowedRoles.filter((roleItem) => roleItem !== candidate)
                      : [...current.allowedRoles, candidate];

                    if (nextRoles.length === 0) {
                      setFeedback('메뉴에는 최소 1개 이상의 허용 역할이 필요합니다.');
                      return current;
                    }

                    return {
                      ...current,
                      allowedRoles: sortRoles(nextRoles)
                    };
                  });
                }}
                onReset={() =>
                  setDrafts((current) => {
                    const next = { ...current };
                    delete next[item.id];
                    return next;
                  })
                }
                onSave={() => updateMutation.mutate({ item, draft })}
              />
            );
          })}

          {rows.length === 0 ? (
            <Alert severity="info" variant="outlined">
              아직 저장된 메뉴가 없습니다. API가 메뉴 기본값을 생성하면 이곳에
              트리가 표시됩니다.
            </Alert>
          ) : null}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function MenuPermissionRow({
  item,
  draft,
  dirty,
  canUpdate,
  isSaving,
  onVisibleChange,
  onRoleToggle,
  onReset,
  onSave
}: {
  item: FlatNavigationItem;
  draft: NavigationDraft;
  dirty: boolean;
  canUpdate: boolean;
  isSaving: boolean;
  onVisibleChange: (isVisible: boolean) => void;
  onRoleToggle: (role: TenantMembershipRole) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const Icon = resolveNavigationIcon(item.iconKey);
  const isGroup = item.itemType === 'GROUP';

  return (
    <Stack
      spacing={1.25}
      sx={{
        ml: Math.min(item.depth, 4) * 2,
        p: 1.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: dirty ? 'primary.light' : 'divider',
        bgcolor: isGroup ? 'primary.50' : 'background.default'
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2.5,
              bgcolor: isGroup ? 'primary.main' : 'action.hover',
              color: isGroup ? 'primary.contrastText' : 'text.secondary',
              flexShrink: 0
            }}
          >
            {Icon ? <Icon fontSize="small" /> : <Typography variant="caption">{item.depth + 1}</Typography>}
          </Stack>
          <Stack spacing={0.5} minWidth={0}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Typography variant="subtitle2" fontWeight={800}>
                {item.label}
              </Typography>
              <Chip
                label={isGroup ? '그룹' : '페이지'}
                size="small"
                color={isGroup ? 'primary' : 'default'}
                variant="outlined"
              />
              {!draft.isVisible ? (
                <Chip label="숨김" size="small" color="warning" variant="outlined" />
              ) : null}
            </Stack>
            {item.description ? (
              <Typography variant="body2" color="text.secondary">
                {item.description}
              </Typography>
            ) : null}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {item.href ? (
                <Link
                  href={item.href as Route}
                  style={{ textDecoration: 'none' }}
                >
                  <Chip
                    clickable
                    label={item.href}
                    size="small"
                    variant="outlined"
                  />
                </Link>
              ) : (
                <Chip label="그룹 전용" size="small" variant="outlined" />
              )}
              {item.parentTrail.length > 0 ? (
                <Chip
                  label={item.parentTrail.join(' / ')}
                  size="small"
                  variant="outlined"
                />
              ) : null}
            </Stack>
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {menuRoles.map((candidate) => {
              const selected = draft.allowedRoles.includes(candidate);

              return (
                <Chip
                  key={candidate}
                  label={readMembershipRoleLabel(candidate)}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  clickable={canUpdate}
                  disabled={!canUpdate}
                  onClick={() => onRoleToggle(candidate)}
                />
              );
            })}
          </Stack>
          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Switch
            checked={draft.isVisible}
            disabled={!canUpdate}
            onChange={(event) => onVisibleChange(event.target.checked)}
          />
        </Stack>
      </Stack>

      {dirty ? (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onReset} disabled={isSaving}>
            되돌리기
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSave}
            disabled={!canUpdate || isSaving}
          >
            저장
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

function MenuMetric({ label, value }: { label: string; value: string }) {
  return (
    <SectionCard title={label}>
      <Typography variant="h5" fontWeight={850}>
        {value}
      </Typography>
    </SectionCard>
  );
}

function flattenNavigationTree(
  items: NavigationMenuItem[],
  parentTrail: string[] = []
): FlatNavigationItem[] {
  return items.flatMap((item) => {
    const current = {
      ...item,
      parentTrail
    };

    return [
      current,
      ...flattenNavigationTree(item.children, [...parentTrail, item.label])
    ];
  });
}

function summarizeNavigation(items: FlatNavigationItem[]) {
  const totalCount = items.length;
  const groupCount = items.filter((item) => item.itemType === 'GROUP').length;
  const pageCount = totalCount - groupCount;
  const hiddenCount = items.filter((item) => !item.isVisible).length;
  const restrictedCount = items.filter(
    (item) => item.allowedRoles.length < menuRoles.length
  ).length;
  const allRoleCount = items.filter(
    (item) => item.allowedRoles.length === menuRoles.length
  ).length;

  return {
    totalCount,
    groupCount,
    pageCount,
    hiddenCount,
    restrictedCount,
    allRoleCount
  };
}

function isDraftDirty(item: NavigationMenuItem, draft: NavigationDraft) {
  return (
    item.isVisible !== draft.isVisible ||
    sortRoles(item.allowedRoles).join(',') !== sortRoles(draft.allowedRoles).join(',')
  );
}

function sortRoles(roles: TenantMembershipRole[]) {
  const order = new Map(menuRoles.map((role, index) => [role, index]));
  return Array.from(new Set(roles)).sort(
    (left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99)
  );
}
