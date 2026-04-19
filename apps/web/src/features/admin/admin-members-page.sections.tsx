'use client';

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
  AdminTenantItem,
  TenantMembershipRole,
  TenantMembershipStatus
} from '@personal-erp/contracts';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import {
  readMembershipRoleLabel,
  readMembershipStatusLabel
} from './admin-labels';

export const adminMemberRoles: TenantMembershipRole[] = [
  'OWNER',
  'MANAGER',
  'EDITOR',
  'VIEWER'
];

export const adminEditableStatuses = [
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
] as const;

export type AdminEditableStatus = (typeof adminEditableStatuses)[number];

type AdminMembersSummary = {
  activeCount: number;
  invitedCount: number;
  privilegedCount: number;
  tenantCount: number;
  statusItems: Array<{
    status: TenantMembershipStatus;
    count: number;
  }>;
  totalCount: number;
};

export function buildAdminMembersSummary(
  members: AdminMemberItem[]
): AdminMembersSummary {
  const counts: Record<TenantMembershipStatus, number> = {
    ACTIVE: 0,
    INVITED: 0,
    SUSPENDED: 0,
    REMOVED: 0
  };
  let privilegedCount = 0;
  const tenantIds = new Set<string>();

  members.forEach((member) => {
    counts[member.status] += 1;
    if (member.tenant?.id) {
      tenantIds.add(member.tenant.id);
    }

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
    tenantCount: tenantIds.size,
    statusItems: statusOrder
      .map((status) => ({
        status,
        count: counts[status]
      }))
      .filter((item) => item.count > 0),
    totalCount: members.length
  };
}

export function createAdminMembersColumns(input: {
  canManageMembers: boolean;
  showTenant: boolean;
  onEdit: (member: AdminMemberItem) => void;
  onRemove: (member: AdminMemberItem) => void;
}): GridColDef<AdminMemberItem>[] {
  const columns: GridColDef<AdminMemberItem>[] = [
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
            disabled={!input.canManageMembers}
            onClick={() => input.onEdit(params.row)}
          >
            변경
          </Button>
          <Button
            size="small"
            color="error"
            disabled={
              !input.canManageMembers || params.row.status === 'REMOVED'
            }
            onClick={() => input.onRemove(params.row)}
          >
            제거
          </Button>
        </Stack>
      )
    }
  ];

  if (input.showTenant) {
    columns.splice(2, 0, {
      field: 'tenantName',
      headerName: '사업장',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => params.row.tenant?.name ?? '-'
    });
  }

  return columns;
}

export function AdminMembersAccessAlert({
  canReadMembers,
  role
}: {
  canReadMembers: boolean;
  role: TenantMembershipRole | null;
}) {
  if (canReadMembers) {
    return null;
  }

  return (
    <Alert severity="warning" variant="outlined">
      회원관리는 소유자 또는 관리자 권한에서 사용할 수 있습니다. 현재 권한은{' '}
      {readMembershipRoleLabel(role)} 입니다.
    </Alert>
  );
}

export function AdminMembersSummarySection({
  summary
}: {
  summary: AdminMembersSummary;
}) {
  return (
    <SectionCard
      title="멤버 운영 기준"
      description="멤버 목록을 먼저 읽고, 선택한 멤버에 대해서만 역할과 상태를 조정하는 흐름으로 정리했습니다."
    >
      <Stack spacing={appLayout.cardGap}>
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 3 }}>
            <MemberInfoItem
              label="전체 멤버"
              value={`${summary.totalCount}명`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MemberInfoItem
              label="활성 멤버"
              value={`${summary.activeCount}명`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MemberInfoItem
              label="초대 대기"
              value={`${summary.invitedCount}명`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MemberInfoItem
              label={summary.tenantCount > 0 ? '사업장' : '관리 역할'}
              value={
                summary.tenantCount > 0
                  ? `${summary.tenantCount}곳`
                  : `${summary.privilegedCount}명`
              }
            />
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary">
          {summary.tenantCount > 0
            ? '전역 관리자는 모든 사업장의 멤버를 함께 보며, 필요한 멤버만 역할과 상태를 조정합니다.'
            : '역할 변경과 제거는 소유자만 실행할 수 있고, 관리자 권한은 조회와 일부 운영 판단에 집중합니다.'}
        </Typography>
      </Stack>
    </SectionCard>
  );
}

export function AdminMembersTableToolbar({
  summary
}: {
  summary: AdminMembersSummary;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {summary.statusItems.map((item) => (
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
        {summary.tenantCount > 0
          ? `전체 ${summary.tenantCount}개 사업장의 멤버를 함께 보고 있습니다.`
          : '역할 변경과 제거는 소유자만 실행할 수 있습니다.'}
      </Typography>
    </Stack>
  );
}

export function AdminMemberInviteDrawer({
  open,
  inviteEmail,
  inviteRole,
  inviteTenantId,
  isSystemAdmin,
  isPending,
  tenants,
  onClose,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteTenantChange,
  onSubmit
}: {
  open: boolean;
  inviteEmail: string;
  inviteRole: TenantMembershipRole;
  inviteTenantId: string;
  isSystemAdmin: boolean;
  isPending: boolean;
  tenants: AdminTenantItem[];
  onClose: () => void;
  onInviteEmailChange: (email: string) => void;
  onInviteRoleChange: (role: TenantMembershipRole) => void;
  onInviteTenantChange: (tenantId: string) => void;
  onSubmit: () => void;
}) {
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="멤버 초대"
      description="초대 링크는 이메일로 발송됩니다."
    >
      {isSystemAdmin ? (
        <TextField
          select
          label="초대할 사업장"
          value={inviteTenantId}
          onChange={(event) => onInviteTenantChange(event.target.value)}
        >
          {tenants.map((tenant) => (
            <MenuItem key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.slug})
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <TextField
        label="이메일"
        value={inviteEmail}
        onChange={(event) => onInviteEmailChange(event.target.value)}
      />
      <TextField
        select
        label="초대 역할"
        value={inviteRole}
        onChange={(event) =>
          onInviteRoleChange(event.target.value as TenantMembershipRole)
        }
      >
        {adminMemberRoles.map((candidate) => (
          <MenuItem key={candidate} value={candidate}>
            {readMembershipRoleLabel(candidate)}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        disabled={isPending || (isSystemAdmin && !inviteTenantId)}
        onClick={onSubmit}
      >
        {isPending ? '발송 중...' : '초대 보내기'}
      </Button>
    </FormDrawer>
  );
}

export function AdminMemberEditDrawer({
  editingMember,
  nextRole,
  nextStatus,
  isRolePending,
  isStatusPending,
  onClose,
  onNextRoleChange,
  onNextStatusChange,
  onSubmitRole,
  onSubmitStatus
}: {
  editingMember: AdminMemberItem | null;
  nextRole: TenantMembershipRole;
  nextStatus: AdminEditableStatus;
  isRolePending: boolean;
  isStatusPending: boolean;
  onClose: () => void;
  onNextRoleChange: (role: TenantMembershipRole) => void;
  onNextStatusChange: (status: AdminEditableStatus) => void;
  onSubmitRole: () => void;
  onSubmitStatus: () => void;
}) {
  return (
    <FormDrawer
      open={Boolean(editingMember)}
      onClose={onClose}
      title="선택 멤버 작업"
      description={
        editingMember
          ? `${editingMember.name}의 역할과 상태를 각각 분리해 조정합니다.`
          : undefined
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
              현재 역할 {readMembershipRoleLabel(editingMember.role)} / 현재
              상태 {readMembershipStatusLabel(editingMember.status)}
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
                onNextRoleChange(event.target.value as TenantMembershipRole)
              }
            >
              {adminMemberRoles.map((candidate) => (
                <MenuItem key={candidate} value={candidate}>
                  {readMembershipRoleLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={isRolePending}
              onClick={onSubmitRole}
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
                onNextStatusChange(event.target.value as AdminEditableStatus)
              }
            >
              {adminEditableStatuses.map((candidate) => (
                <MenuItem key={candidate} value={candidate}>
                  {readMembershipStatusLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              disabled={isStatusPending}
              onClick={onSubmitStatus}
            >
              상태 변경
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </FormDrawer>
  );
}

export function AdminMemberRemoveDialog({
  removeTarget,
  busy,
  onClose,
  onConfirm
}: {
  removeTarget: AdminMemberItem | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
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
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString().slice(0, 10);
}

function MemberInfoItem({ label, value }: { label: string; value: string }) {
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
