'use client';

import Link from 'next/link';
import { Button, Chip, Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { StatusChip } from '@/shared/ui/status-chip';
import { formatDate, formatWon } from '@/shared/lib/format';
import { InsurancePolicyForm } from './insurance-policy-form';

const cycleLabelMap: Record<string, string> = {
  MONTHLY: '매월',
  YEARLY: '매년'
};

export function buildInsurancePolicyColumns({
  onDelete,
  onEdit
}: {
  onDelete: (insurancePolicy: InsurancePolicyItem) => void;
  onEdit: (insurancePolicy: InsurancePolicyItem) => void;
}): GridColDef<InsurancePolicyItem>[] {
  return [
    { field: 'provider', headerName: '보험사', flex: 1 },
    { field: 'productName', headerName: '상품명', flex: 1.4 },
    {
      field: 'monthlyPremiumWon',
      headerName: '월 보험료',
      flex: 1,
      valueFormatter: (value) => formatWon(Number(value))
    },
    { field: 'paymentDay', headerName: '납부일', flex: 0.7 },
    {
      field: 'cycle',
      headerName: '주기',
      flex: 0.8,
      valueFormatter: (value) => cycleLabelMap[String(value)] ?? String(value)
    },
    {
      field: 'fundingAccountName',
      headerName: '자금수단',
      flex: 1.1,
      valueFormatter: (value) => (value ? String(value) : '미설정')
    },
    {
      field: 'categoryName',
      headerName: '카테고리',
      flex: 1,
      valueFormatter: (value) => (value ? String(value) : '미설정')
    },
    {
      field: 'recurringStartDate',
      headerName: '반복 시작',
      flex: 1,
      valueFormatter: (value) => (value ? formatDate(String(value)) : '-')
    },
    {
      field: 'linkedRecurringRuleId',
      headerName: '연결 규칙',
      flex: 0.9,
      sortable: false,
      renderCell: (params) => (
        <StatusChip label={params.value ? '연결됨' : '미연결'} />
      )
    },
    {
      field: 'isActive',
      headerName: '상태',
      flex: 0.8,
      renderCell: (params) => (
        <StatusChip label={params.value ? '활성' : '비활성'} />
      )
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 1.5,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              onEdit(params.row);
            }}
          >
            수정
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => {
              onDelete(params.row);
            }}
          >
            삭제
          </Button>
        </Stack>
      )
    }
  ];
}

export function InsurancePoliciesToolbar({
  activeCount,
  linkedCount,
  unlinkedCount
}: {
  activeCount: number;
  linkedCount: number;
  unlinkedCount: number;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip
          label={`활성 ${activeCount}건`}
          size="small"
          color="success"
          variant="filled"
        />
        <Chip
          label={`연결 완료 ${linkedCount}건`}
          size="small"
          color={linkedCount > 0 ? 'primary' : 'default'}
          variant="outlined"
        />
        <Chip
          label={`미연결 ${unlinkedCount}건`}
          size="small"
          color={unlinkedCount > 0 ? 'warning' : 'default'}
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        보험 계약은 표에서 먼저 확인하고, 생성과 수정은 드로어에서 이어서 처리합니다.
      </Typography>
    </Stack>
  );
}

export function InsuranceSummaryGrid({
  inactiveCount,
  linkedCount,
  totalCount,
  totalPremium,
  unlinkedCount
}: {
  inactiveCount: number;
  linkedCount: number;
  totalCount: number;
  totalPremium: string;
  unlinkedCount: number;
}) {
  return (
    <Grid container spacing={appLayout.sectionGap}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Stack
          spacing={appLayout.cardGap}
          sx={{
            p: appLayout.cardPadding,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Typography variant="h6">목록 읽는 기준</Typography>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InfoItem label="활성 월 보험료" value={totalPremium} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InfoItem label="전체 계약" value={`${totalCount}건`} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InfoItem label="비활성" value={`${inactiveCount}건`} />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`연결 완료 ${linkedCount}건`} size="small" color="success" />
            <Chip
              label={`미연결 ${unlinkedCount}건`}
              size="small"
              color={unlinkedCount > 0 ? 'warning' : 'default'}
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, lg: 5 }}>
        <Stack
          spacing={1.25}
          sx={{
            p: appLayout.cardPadding,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Typography variant="h6">연결 규칙과 후속 화면</Typography>
          <SupportLink
            title="반복 규칙"
            description="보험 계약 저장 시 생성되는 연결 반복 규칙 상태를 함께 확인합니다."
            href="/recurring"
            actionLabel="반복 규칙 보기"
          />
          <SupportLink
            title="계획 항목"
            description="현재 운영 월에서 보험료 계획이 실제 생성됐는지 확인합니다."
            href="/plan-items"
            actionLabel="계획 항목 보기"
          />
        </Stack>
      </Grid>
    </Grid>
  );
}

export function InsurancePolicyDrawer({
  drawerState,
  onClose,
  onCompleted
}: {
  drawerState:
    | { mode: 'create' }
    | { mode: 'edit'; insurancePolicy: InsurancePolicyItem }
    | null;
  onClose: () => void;
  onCompleted: (
    insurancePolicy: InsurancePolicyItem,
    mode: 'create' | 'edit'
  ) => void;
}) {
  return (
    <FormDrawer
      open={drawerState !== null}
      onClose={onClose}
      title={drawerState?.mode === 'edit' ? '보험 계약 수정' : '보험 계약 등록'}
      description={
        drawerState?.mode === 'edit'
          ? '보험 계약 기준을 조정하면 연결된 반복 규칙도 함께 동기화합니다.'
          : '보험 계약과 연결된 반복 규칙 기준을 함께 추가합니다.'
      }
    >
      {drawerState?.mode === 'edit' ? (
        <InsurancePolicyForm
          mode="edit"
          initialPolicy={drawerState.insurancePolicy}
          onCompleted={onCompleted}
        />
      ) : (
        <InsurancePolicyForm mode="create" onCompleted={onCompleted} />
      )}
    </FormDrawer>
  );
}

export function InsuranceDeleteDialog({
  busy,
  deleteTarget,
  onClose,
  onConfirm
}: {
  busy: boolean;
  deleteTarget: InsurancePolicyItem | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmActionDialog
      open={deleteTarget !== null}
      title="보험 계약 삭제"
      description={
        deleteTarget
          ? deleteTarget.linkedRecurringRuleId
            ? `"${deleteTarget.productName}" 보험 계약을 삭제할까요? 연결된 반복 규칙도 함께 삭제됩니다.`
            : `"${deleteTarget.productName}" 보험 계약을 삭제할까요?`
          : ''
      }
      confirmLabel="삭제"
      pendingLabel="삭제 중..."
      confirmColor="error"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function SupportLink({
  title,
  description,
  href,
  actionLabel
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined">
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}

function InfoItem({
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
