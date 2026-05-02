'use client';

import { useEffect, useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import type {
  AdminMemberItem,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  adminMembersQueryKey,
  adminTenantsQueryKey,
  adminUsersQueryKey,
  getAdminMembers,
  getAdminTenants,
  getAdminUsers,
  inviteAdminMember,
  removeAdminMember,
  updateAdminMemberRole,
  updateAdminMemberStatus
} from './admin.api';
import { readMembershipRoleLabel } from './admin-labels';
import {
  type AdminEditableStatus,
  AdminMembersFilterToolbar,
  AdminMemberEditDrawer,
  AdminMemberInviteDrawer,
  AdminMemberRemoveDialog,
  AdminMembersAccessAlert,
  AdminMembersSummarySection,
  type AdminMembersTableFilters,
  buildAdminMembersSummary,
  createAdminMembersColumns
} from './admin-members-page.sections';

export function AdminMembersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const isSystemAdmin = user?.isSystemAdmin === true;
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadMembers =
    isSystemAdmin || role === 'OWNER' || role === 'MANAGER';
  const canManageMembers = isSystemAdmin || role === 'OWNER';
  const [feedback, setFeedback] = useState<FeedbackAlertValue>(null);
  const [inviteFeedback, setInviteFeedback] =
    useState<FeedbackAlertValue>(null);
  const [editFeedback, setEditFeedback] = useState<FeedbackAlertValue>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantMembershipRole>('VIEWER');
  const [inviteTenantId, setInviteTenantId] = useState('');
  const [editingMember, setEditingMember] = useState<AdminMemberItem | null>(
    null
  );
  const [nextRole, setNextRole] = useState<TenantMembershipRole>('VIEWER');
  const [nextStatus, setNextStatus] = useState<AdminEditableStatus>('ACTIVE');
  const [removeTarget, setRemoveTarget] = useState<AdminMemberItem | null>(
    null
  );
  const [tableFilters, setTableFilters] = useState<AdminMembersTableFilters>({
    keyword: '',
    role: '',
    status: '',
    tenantName: ''
  });

  const membersQuery = useQuery({
    queryKey: adminMembersQueryKey,
    queryFn: getAdminMembers,
    enabled: canReadMembers
  });
  const tenantsQuery = useQuery({
    queryKey: adminTenantsQueryKey,
    queryFn: getAdminTenants,
    enabled: isSystemAdmin
  });
  const usersQuery = useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: getAdminUsers,
    enabled: isSystemAdmin
  });
  const tenants = tenantsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const filteredMembers = useMemo(
    () => filterAdminMembers(members, tableFilters),
    [members, tableFilters]
  );
  const tenantOptions = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((member) => member.tenant?.name)
            .filter((name): name is string => Boolean(name))
        )
      ).sort((left, right) => left.localeCompare(right, 'ko-KR')),
    [members]
  );
  const memberSummary = useMemo(
    () => buildAdminMembersSummary(members),
    [members]
  );

  useEffect(() => {
    if (!isSystemAdmin || inviteTenantId || tenants.length === 0) {
      return;
    }

    setInviteTenantId(tenants[0]!.id);
  }, [inviteTenantId, isSystemAdmin, tenants]);

  const invalidateMembers = async () => {
    await queryClient.invalidateQueries({ queryKey: adminMembersQueryKey });
  };

  const inviteMutation = useMutation({
    mutationFn: inviteAdminMember,
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: '초대 메일을 보냈습니다.' });
      setInviteFeedback(null);
      setInviteOpen(false);
      setInviteEmail('');
      await invalidateMembers();
    },
    onError: (error) => {
      setInviteFeedback(buildErrorFeedback(error, '초대에 실패했습니다.'));
    }
  });

  const roleMutation = useMutation({
    mutationFn: (input: {
      member: AdminMemberItem;
      role: TenantMembershipRole;
    }) =>
      updateAdminMemberRole(
        input.member.id,
        { role: input.role },
        input.member
      ),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '멤버 역할을 변경했습니다.'
      });
      setEditFeedback(null);
      setEditingMember(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setEditFeedback(buildErrorFeedback(error, '역할 변경에 실패했습니다.'));
    }
  });

  const statusMutation = useMutation({
    mutationFn: (input: {
      member: AdminMemberItem;
      status: AdminEditableStatus;
    }) =>
      updateAdminMemberStatus(
        input.member.id,
        { status: input.status },
        input.member
      ),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message: '멤버 상태를 변경했습니다.'
      });
      setEditFeedback(null);
      setEditingMember(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setEditFeedback(buildErrorFeedback(error, '상태 변경에 실패했습니다.'));
    }
  });

  const removeMutation = useMutation({
    mutationFn: (member: AdminMemberItem) => removeAdminMember(member.id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: '멤버를 제거했습니다.' });
      setRemoveTarget(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setFeedback(buildErrorFeedback(error, '멤버 제거에 실패했습니다.'));
    }
  });

  const columns = useMemo(
    () =>
      createAdminMembersColumns({
        canManageMembers,
        showTenant: isSystemAdmin,
        onEdit: (member) => {
          setFeedback(null);
          setEditFeedback(null);
          setEditingMember(member);
          setNextRole(member.role);
          setNextStatus(member.status === 'INVITED' ? 'ACTIVE' : member.status);
        },
        onRemove: setRemoveTarget
      }),
    [canManageMembers, isSystemAdmin]
  );

  useDomainHelp({
    title: '회원 관리 화면 도움말',
    description: isSystemAdmin
      ? '회원 관리는 모든 사업장의 멤버를 읽고, 필요한 멤버만 역할·상태를 조정하는 화면입니다.'
      : '회원 관리는 현재 사업장 멤버를 읽고, 필요할 때만 초대·역할·상태를 조정하는 화면입니다.',
    primaryEntity: isSystemAdmin ? '전체 사업장 멤버' : '사업장 멤버',
    relatedEntities: ['사용자', '초대', '감사 로그'],
    truthSource:
      '실제 권한은 멤버 역할과 상태로 결정되며, 변경 이력은 감사 이벤트로 함께 남습니다.',
    supplementarySections: [
      {
        title: '작업 진행 순서',
        items: [
          '먼저 멤버 목록에서 역할, 상태, 초대 여부를 확인합니다.',
          '새 사용자를 추가할 때는 멤버 초대로 이메일과 역할을 지정합니다.',
          '역할이나 상태를 바꿀 때는 대상 사업장과 현재 권한을 확인한 뒤 저장합니다.',
          '더 이상 접근하면 안 되는 멤버만 제거하고, 처리 후 목록과 감사 로그를 확인합니다.'
        ]
      },
      {
        title: '권한 기준',
        items: [
          '소유자는 초대와 역할·상태 변경을 수행합니다.',
          '전역 관리자는 모든 사업장의 멤버와 사용자를 함께 관리합니다.',
          '관리자는 목록을 읽고 운영 판단에 활용합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '감사 로그',
            description:
              '초대, 역할 변경, 상태 변경, 제거 작업이 어떤 요청으로 기록됐는지 확인합니다.',
            href: '/admin/logs',
            actionLabel: '감사 로그 열기'
          },
          {
            title: '메뉴 / 권한 관리',
            description:
              '역할별로 실제 보이는 메뉴와 접근 가능한 화면을 조정합니다.',
            href: '/admin/navigation',
            actionLabel: '메뉴 권한 열기'
          },
          {
            title: '권한 정책 요약',
            description:
              '현재 메뉴 트리 기준으로 역할별 접근 범위를 읽기 전용 표로 확인합니다.',
            href: '/admin/policy',
            actionLabel: '권한 정책 열기'
          }
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title={isSystemAdmin ? '전체 회원 관리' : '회원 관리'}
        description={
          isSystemAdmin
            ? '모든 사업장의 멤버를 한 화면에서 확인하고, 필요한 경우에만 역할과 상태를 조정합니다.'
            : '사업장 멤버 목록을 먼저 확인하고, 필요한 경우에만 역할과 상태를 조정합니다.'
        }
        badges={[
          {
            label: !canReadMembers
              ? '권한 필요'
              : isSystemAdmin
                ? '전체 관리자'
                : canManageMembers
                  ? '역할·상태 변경 가능'
                  : '조회 전용',
            color: !canReadMembers
              ? 'warning'
              : canManageMembers
                ? 'primary'
                : 'default'
          }
        ]}
        metadata={[
          {
            label: '현재 권한',
            value: isSystemAdmin ? '전체 관리자' : readMembershipRoleLabel(role)
          },
          ...(isSystemAdmin
            ? [{ label: '사업장', value: `${tenants.length}곳` }]
            : []),
          ...(isSystemAdmin
            ? [{ label: '전체 사용자', value: `${users.length}명` }]
            : []),
          { label: '전체 멤버', value: `${memberSummary.totalCount}명` },
          {
            label: '활성 / 초대',
            value: `${memberSummary.activeCount}명 / ${memberSummary.invitedCount}명`
          },
          {
            label: '관리 역할',
            value: `${memberSummary.privilegedCount}명`
          }
        ]}
        primaryActionLabel="멤버 초대"
        primaryActionOnClick={() => {
          setFeedback(null);
          setInviteFeedback(null);
          setInviteOpen(true);
        }}
        primaryActionDisabled={
          !canManageMembers || (isSystemAdmin && tenants.length === 0)
        }
        secondaryActionLabel="멤버 목록 보기"
        secondaryActionHref="#member-table"
      />
      <FeedbackAlert feedback={feedback} />

      <AdminMembersAccessAlert canReadMembers={canReadMembers} role={role} />

      {membersQuery.error ? (
        <QueryErrorAlert
          title="멤버 목록을 불러오지 못했습니다."
          error={membersQuery.error}
        />
      ) : null}

      {tenantsQuery.error ? (
        <QueryErrorAlert
          title="사업장 목록을 불러오지 못했습니다."
          error={tenantsQuery.error}
        />
      ) : null}

      {usersQuery.error ? (
        <QueryErrorAlert
          title="사용자 목록을 불러오지 못했습니다."
          error={usersQuery.error}
        />
      ) : null}

      <AdminMembersSummarySection summary={memberSummary} />

      <div id="member-table">
        <DataTableCard
          title="멤버 목록"
          description="역할과 상태를 먼저 검토한 뒤, 필요한 멤버만 수정합니다."
          toolbar={
            <AdminMembersFilterToolbar
              filters={tableFilters}
              summary={memberSummary}
              tenantOptions={tenantOptions}
              onFiltersChange={setTableFilters}
            />
          }
          rows={filteredMembers}
          columns={columns}
          height={520}
        />
      </div>

      <AdminMemberInviteDrawer
        open={inviteOpen}
        feedback={inviteFeedback}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteTenantId={inviteTenantId}
        isSystemAdmin={isSystemAdmin}
        isPending={inviteMutation.isPending}
        tenants={tenants}
        onClose={() => {
          setInviteOpen(false);
          setInviteFeedback(null);
        }}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onInviteTenantChange={setInviteTenantId}
        onSubmit={() => {
          setFeedback(null);
          setInviteFeedback(null);
          inviteMutation.mutate({
            email: inviteEmail,
            role: inviteRole,
            ...(isSystemAdmin ? { tenantId: inviteTenantId } : {})
          });
        }}
      />

      <AdminMemberEditDrawer
        editingMember={editingMember}
        feedback={editFeedback}
        nextRole={nextRole}
        nextStatus={nextStatus}
        isRolePending={roleMutation.isPending}
        isStatusPending={statusMutation.isPending}
        onClose={() => {
          setEditingMember(null);
          setEditFeedback(null);
        }}
        onNextRoleChange={setNextRole}
        onNextStatusChange={setNextStatus}
        onSubmitRole={() => {
          if (editingMember) {
            setFeedback(null);
            setEditFeedback(null);
            roleMutation.mutate({ member: editingMember, role: nextRole });
          }
        }}
        onSubmitStatus={() => {
          if (editingMember) {
            setFeedback(null);
            setEditFeedback(null);
            statusMutation.mutate({
              member: editingMember,
              status: nextStatus
            });
          }
        }}
      />

      <AdminMemberRemoveDialog
        removeTarget={removeTarget}
        busy={removeMutation.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget);
          }
        }}
      />
    </Stack>
  );
}

function filterAdminMembers(
  members: AdminMemberItem[],
  filters: AdminMembersTableFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return members.filter((member) => {
    if (filters.role && member.role !== filters.role) {
      return false;
    }

    if (filters.status && member.status !== filters.status) {
      return false;
    }

    if (filters.tenantName && member.tenant?.name !== filters.tenantName) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return normalizeFilterText(
      [member.name, member.email, member.tenant?.name].filter(Boolean).join(' ')
    ).includes(keyword);
  });
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}
