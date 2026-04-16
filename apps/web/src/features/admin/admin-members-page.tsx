'use client';

import { useMemo, useState } from 'react';
import { Alert, Stack } from '@mui/material';
import type {
  AdminMemberItem,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  adminMembersQueryKey,
  getAdminMembers,
  inviteAdminMember,
  removeAdminMember,
  updateAdminMemberRole,
  updateAdminMemberStatus
} from './admin.api';
import { readMembershipRoleLabel } from './admin-labels';
import {
  type AdminEditableStatus,
  AdminMemberEditDrawer,
  AdminMemberInviteDrawer,
  AdminMemberRemoveDialog,
  AdminMembersAccessAlert,
  AdminMembersSummarySection,
  AdminMembersTableToolbar,
  buildAdminMembersSummary,
  createAdminMembersColumns
} from './admin-members-page.sections';
import { AdminSectionNav } from './admin-section-nav';

export function AdminMembersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadMembers = role === 'OWNER' || role === 'MANAGER';
  const canManageMembers = role === 'OWNER';
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantMembershipRole>('VIEWER');
  const [editingMember, setEditingMember] = useState<AdminMemberItem | null>(
    null
  );
  const [nextRole, setNextRole] = useState<TenantMembershipRole>('VIEWER');
  const [nextStatus, setNextStatus] = useState<AdminEditableStatus>('ACTIVE');
  const [removeTarget, setRemoveTarget] = useState<AdminMemberItem | null>(
    null
  );

  const membersQuery = useQuery({
    queryKey: adminMembersQueryKey,
    queryFn: getAdminMembers,
    enabled: canReadMembers
  });
  const members = membersQuery.data ?? [];
  const memberSummary = useMemo(
    () => buildAdminMembersSummary(members),
    [members]
  );

  const invalidateMembers = async () => {
    await queryClient.invalidateQueries({ queryKey: adminMembersQueryKey });
  };

  const inviteMutation = useMutation({
    mutationFn: inviteAdminMember,
    onSuccess: async () => {
      setFeedback('초대 메일을 보냈습니다.');
      setInviteOpen(false);
      setInviteEmail('');
      await invalidateMembers();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '초대에 실패했습니다.'
      );
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
      setFeedback('멤버 역할을 변경했습니다.');
      setEditingMember(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '역할 변경에 실패했습니다.'
      );
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
      setFeedback('멤버 상태를 변경했습니다.');
      setEditingMember(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '상태 변경에 실패했습니다.'
      );
    }
  });

  const removeMutation = useMutation({
    mutationFn: (member: AdminMemberItem) => removeAdminMember(member.id),
    onSuccess: async () => {
      setFeedback('멤버를 제거했습니다.');
      setRemoveTarget(null);
      await invalidateMembers();
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : '멤버 제거에 실패했습니다.'
      );
    }
  });

  const columns = useMemo(
    () =>
      createAdminMembersColumns({
        canManageMembers,
        onEdit: (member) => {
          setEditingMember(member);
          setNextRole(member.role);
          setNextStatus(member.status === 'INVITED' ? 'ACTIVE' : member.status);
        },
        onRemove: setRemoveTarget
      }),
    [canManageMembers]
  );

  useDomainHelp({
    title: '회원 관리 가이드',
    description:
      '회원 관리는 현재 워크스페이스 멤버를 읽고, 필요할 때만 초대·역할·상태를 조정하는 화면입니다.',
    primaryEntity: 'TenantMembership',
    relatedEntities: [
      'User',
      'TenantMembershipInvitation',
      'WorkspaceAuditEvent'
    ],
    truthSource:
      '실제 권한은 멤버 역할과 상태로 결정되며, 변경 이력은 감사 이벤트로 함께 남습니다.',
    supplementarySections: [
      {
        title: '기본 순서',
        items: [
          '먼저 멤버 목록에서 역할과 상태를 확인합니다.',
          '필요한 경우에만 초대, 역할 변경, 상태 변경, 제거를 수행합니다.'
        ]
      },
      {
        title: '권한 기준',
        items: [
          'OWNER는 초대와 역할·상태 변경을 수행합니다.',
          'MANAGER는 목록을 읽고 운영 판단에 활용합니다.'
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="회원 관리"
        description="사업장 멤버 목록을 먼저 확인하고, 필요한 경우에만 역할과 상태를 조정합니다."
        badges={[
          {
            label: !canReadMembers
              ? '권한 필요'
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
          { label: '현재 권한', value: readMembershipRoleLabel(role) },
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
        primaryActionOnClick={() => setInviteOpen(true)}
        primaryActionDisabled={!canManageMembers}
        secondaryActionLabel="멤버 목록 보기"
        secondaryActionHref="#member-table"
      />

      <AdminSectionNav />

      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}

      <AdminMembersAccessAlert canReadMembers={canReadMembers} role={role} />

      {membersQuery.error ? (
        <QueryErrorAlert
          title="멤버 목록을 불러오지 못했습니다."
          error={membersQuery.error}
        />
      ) : null}

      <AdminMembersSummarySection summary={memberSummary} />

      <div id="member-table">
        <DataTableCard
          title="멤버 목록"
          description="역할과 상태를 먼저 검토한 뒤, 필요한 멤버만 수정합니다."
          toolbar={<AdminMembersTableToolbar summary={memberSummary} />}
          rows={members}
          columns={columns}
          height={520}
        />
      </div>

      <AdminMemberInviteDrawer
        open={inviteOpen}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        isPending={inviteMutation.isPending}
        onClose={() => setInviteOpen(false)}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onSubmit={() =>
          inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
        }
      />

      <AdminMemberEditDrawer
        editingMember={editingMember}
        nextRole={nextRole}
        nextStatus={nextStatus}
        isRolePending={roleMutation.isPending}
        isStatusPending={statusMutation.isPending}
        onClose={() => setEditingMember(null)}
        onNextRoleChange={setNextRole}
        onNextStatusChange={setNextStatus}
        onSubmitRole={() => {
          if (editingMember) {
            roleMutation.mutate({ member: editingMember, role: nextRole });
          }
        }}
        onSubmitStatus={() => {
          if (editingMember) {
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
