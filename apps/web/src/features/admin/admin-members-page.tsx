'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AdminMemberItem,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
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
import {
  readMembershipRoleLabel,
  readMembershipStatusLabel
} from './admin-labels';
import { AdminSectionNav } from './admin-section-nav';

const memberRoles: TenantMembershipRole[] = [
  'OWNER',
  'MANAGER',
  'EDITOR',
  'VIEWER'
];
const editableStatuses = ['ACTIVE', 'SUSPENDED', 'REMOVED'] as const;

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
  const [nextStatus, setNextStatus] =
    useState<(typeof editableStatuses)[number]>('ACTIVE');
  const [removeTarget, setRemoveTarget] = useState<AdminMemberItem | null>(
    null
  );

  const membersQuery = useQuery({
    queryKey: adminMembersQueryKey,
    queryFn: getAdminMembers,
    enabled: canReadMembers
  });

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
      status: (typeof editableStatuses)[number];
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

  const columns = useMemo<GridColDef<AdminMemberItem>[]>(
    () => [
      { field: 'name', headerName: '이름', flex: 1, minWidth: 140 },
      { field: 'email', headerName: '이메일', flex: 1.3, minWidth: 200 },
      {
        field: 'role',
        headerName: '역할',
        width: 110,
        valueFormatter: (value) => readMembershipRoleLabel(String(value))
      },
      {
        field: 'status',
        headerName: '상태',
        width: 110,
        valueFormatter: (value) => readMembershipStatusLabel(String(value))
      },
      {
        field: 'joinedAt',
        headerName: '참여일',
        width: 140,
        valueFormatter: (value) => formatDate(String(value))
      },
      {
        field: 'actions',
        headerName: '관리',
        sortable: false,
        filterable: false,
        width: 180,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={!canManageMembers}
              onClick={() => {
                setEditingMember(params.row);
                setNextRole(params.row.role);
                setNextStatus(
                  params.row.status === 'INVITED' ? 'ACTIVE' : params.row.status
                );
              }}
            >
              변경
            </Button>
            <Button
              size="small"
              color="error"
              disabled={!canManageMembers || params.row.status === 'REMOVED'}
              onClick={() => setRemoveTarget(params.row)}
            >
              제거
            </Button>
          </Stack>
        )
      }
    ],
    [canManageMembers]
  );

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="회원관리"
        description="현재 사업장 멤버의 역할과 상태를 관리합니다."
      />

      <AdminSectionNav />

      {feedback ? <Alert variant="outlined">{feedback}</Alert> : null}

      {!canReadMembers ? (
        <Alert severity="warning" variant="outlined">
          회원관리는 소유자 또는 관리자 권한에서 사용할 수 있습니다. 현재 권한은{' '}
          {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      {membersQuery.error ? (
        <QueryErrorAlert
          title="멤버 목록을 불러오지 못했습니다."
          error={membersQuery.error}
        />
      ) : null}

      <DataTableCard
        title="사업장 멤버"
        description="역할 변경과 제거는 소유자만 실행할 수 있습니다."
        rows={membersQuery.data ?? []}
        columns={columns}
        height={520}
        actions={
          <Button
            variant="contained"
            disabled={!canManageMembers}
            onClick={() => setInviteOpen(true)}
          >
            멤버 초대
          </Button>
        }
      />

      <FormDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="멤버 초대"
        description="초대 링크는 이메일로 발송됩니다."
      >
        <TextField
          label="이메일"
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
        />
        <TextField
          select
          label="초대 역할"
          value={inviteRole}
          onChange={(event) =>
            setInviteRole(event.target.value as TenantMembershipRole)
          }
        >
          {memberRoles.map((candidate) => (
            <MenuItem key={candidate} value={candidate}>
              {readMembershipRoleLabel(candidate)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          disabled={inviteMutation.isPending}
          onClick={() => {
            inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
          }}
        >
          {inviteMutation.isPending ? '발송 중...' : '초대 보내기'}
        </Button>
      </FormDrawer>

      <FormDrawer
        open={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        title="멤버 권한 변경"
        description={
          editingMember ? `${editingMember.name}의 역할과 상태` : undefined
        }
      >
        {editingMember ? (
          <>
            <Typography variant="body2" color="text.secondary">
              {editingMember.email}
            </Typography>
            <TextField
              select
              label="역할"
              value={nextRole}
              onChange={(event) =>
                setNextRole(event.target.value as TenantMembershipRole)
              }
            >
              {memberRoles.map((candidate) => (
                <MenuItem key={candidate} value={candidate}>
                  {readMembershipRoleLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={roleMutation.isPending}
              onClick={() =>
                roleMutation.mutate({ member: editingMember, role: nextRole })
              }
            >
              역할 변경
            </Button>

            <TextField
              select
              label="상태"
              value={nextStatus}
              onChange={(event) =>
                setNextStatus(
                  event.target.value as (typeof editableStatuses)[number]
                )
              }
            >
              {editableStatuses.map((candidate) => (
                <MenuItem key={candidate} value={candidate}>
                  {readMembershipStatusLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              disabled={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  member: editingMember,
                  status: nextStatus
                })
              }
            >
              상태 변경
            </Button>
          </>
        ) : null}
      </FormDrawer>

      <ConfirmActionDialog
        open={Boolean(removeTarget)}
        title="멤버 제거"
        description={
          removeTarget
            ? `${removeTarget.name} 멤버를 현재 사업장에서 제거합니다.`
            : ''
        }
        confirmLabel="제거"
        confirmColor="error"
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().slice(0, 10);
}
