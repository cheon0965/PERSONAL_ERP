'use client';

import { Button, Chip, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { GridActionCell } from '@/shared/ui/data-grid-cell';
import { FormDrawer } from '@/shared/ui/form-drawer';
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
      minWidth: 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <GridActionCell>
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
        </GridActionCell>
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
        보험 계약은 표에서 먼저 확인하고, 생성과 수정은 드로어에서 이어서
        처리합니다.
      </Typography>
    </Stack>
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
