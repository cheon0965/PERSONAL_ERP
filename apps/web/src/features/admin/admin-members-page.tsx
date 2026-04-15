'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AdminMemberItem,
  TenantMembershipRole,
  TenantMembershipStatus
} from '@personal-erp/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
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
  const members = membersQuery.data ?? [];
  const memberSummary = useMemo(() => {
    const counts: Record<TenantMembershipStatus, number> = {
      ACTIVE: 0,
      INVITED: 0,
      SUSPENDED: 0,
      REMOVED: 0
    };
    let privilegedCount = 0;

    members.forEach((member) => {
      counts[member.status] += 1;

      if (member.role === 'OWNER' || member.role === 'MANAGER') {
        privilegedCount += 1;
      }
    });

    const statusOrder: TenantMembershipStatus[] = [
      'ACTIVE',
      'INVITED',
      'SUSPENDED',
      'REMOVED'
    ];

    return {
      activeCount: counts.ACTIVE,
      invitedCount: counts.INVITED,
      privilegedCount,
      statusItems: statusOrder
        .map((status) => ({
          status,
          count: counts[status]
        }))
        .filter((item) => item.count > 0),
      totalCount: members.length
    };
  }, [members]);

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

      <SectionCard
        title="멤버 운영 기준"
        description="멤버 목록을 먼저 읽고, 선택한 멤버에 대해서만 역할과 상태를 조정하는 흐름으로 정리했습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 3 }}>
              <MemberInfoItem
                label="전체 멤버"
                value={`${memberSummary.totalCount}명`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MemberInfoItem
                label="활성 멤버"
                value={`${memberSummary.activeCount}명`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MemberInfoItem
                label="초대 대기"
                value={`${memberSummary.invitedCount}명`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MemberInfoItem
                label="관리 역할"
                value={`${memberSummary.privilegedCount}명`}
              />
            </Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary">
            역할 변경과 제거는 소유자만 실행할 수 있고, 관리자 권한은 조회와 일부 운영 판단에 집중합니다.
          </Typography>
        </Stack>
      </SectionCard>

      <div id="member-table">
        <DataTableCard
          title="멤버 목록"
          description="역할과 상태를 먼저 검토한 뒤, 필요한 멤버만 수정합니다."
          toolbar={
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {memberSummary.statusItems.map((item) => (
                  <Chip
                    key={item.status}
                    label={`${readMembershipStatusLabel(item.status)} ${item.count}명`}
                    size="small"
                    color={
                      item.status === 'ACTIVE'
                        ? 'success'
                        : item.status === 'INVITED'
                          ? 'primary'
                          : item.status === 'SUSPENDED'
                            ? 'warning'
                            : 'default'
                    }
                    variant={item.status === 'ACTIVE' ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                역할 변경과 제거는 소유자만 실행할 수 있습니다.
              </Typography>
            </Stack>
          }
          rows={members}
          columns={columns}
          height={520}
        />
      </div>

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
        title="선택 멤버 작업"
        description={
          editingMember ? `${editingMember.name}의 역할과 상태를 각각 분리해 조정합니다.` : undefined
        }
      >
        {editingMember ? (
          <Stack spacing={2}>
            <Stack
              spacing={0.5}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.default'
              }}
            >
              <Typography variant="subtitle2">{editingMember.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {editingMember.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                현재 역할 {readMembershipRoleLabel(editingMember.role)} / 현재 상태{' '}
                {readMembershipStatusLabel(editingMember.status)}
              </Typography>
            </Stack>

            <Stack
              spacing={1.25}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle2">역할 조정</Typography>
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
            </Stack>

            <Stack
              spacing={1.25}
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle2">상태 조정</Typography>
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
            </Stack>
          </Stack>
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

function MemberInfoItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
