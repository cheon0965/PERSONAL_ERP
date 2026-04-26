'use client';

import Link from 'next/link';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { formatDate, formatWon } from '@/shared/lib/format';
import { GridActionCell } from '@/shared/ui/data-grid-cell';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { StatusChip } from '@/shared/ui/status-chip';
import { RecurringRuleForm } from './recurring-rule-form';
import type {
  ManagedRecurringRuleDetailItem,
  ManagedRecurringRuleItem
} from './recurring-rules.api';

const frequencyLabelMap: Record<string, string> = {
  WEEKLY: '매주',
  MONTHLY: '매월',
  QUARTERLY: '분기',
  YEARLY: '매년'
};

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

export function createRecurringRulesColumns(input: {
  onEdit: (recurringRule: ManagedRecurringRuleItem) => void;
  onDelete: (recurringRule: ManagedRecurringRuleItem) => void;
}): GridColDef<ManagedRecurringRuleItem>[] {
  return [
    { field: 'title', headerName: '제목', flex: 1.2 },
    {
      field: 'amountWon',
      headerName: '금액',
      flex: 1,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'frequency',
      headerName: '주기',
      flex: 0.8,
      valueFormatter: (value) =>
        frequencyLabelMap[String(value)] ?? String(value)
    },
    {
      field: 'nextRunDate',
      headerName: '다음 실행일',
      flex: 1,
      valueFormatter: (value) => (value ? formatDate(String(value)) : '-')
    },
    { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
    { field: 'categoryName', headerName: '카테고리', flex: 1 },
    {
      field: 'linkedInsurancePolicyId',
      headerName: '관리 원본',
      flex: 0.9,
      sortable: false,
      renderCell: (params) => (
        <StatusChip label={params.value ? '보험 계약 연동' : '직접 작성'} />
      )
    },
    {
      field: 'isActive',
      headerName: '규칙 상태',
      flex: 0.7,
      renderCell: (params) => (
        <StatusChip label={params.value ? '활성' : '중지'} />
      )
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 1.5,
      minWidth: 220,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.linkedInsurancePolicyId ? (
          <Button
            component={Link}
            href="/insurances"
            size="small"
            variant="outlined"
          >
            보험 계약에서 관리
          </Button>
        ) : (
          <GridActionCell>
            <Button
              size="small"
              variant="outlined"
              onClick={() => input.onEdit(params.row)}
            >
              수정
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() => input.onDelete(params.row)}
            >
              삭제
            </Button>
          </GridActionCell>
        )
    }
  ];
}

export function RecurringRulesFeedbackAlerts({
  feedback,
  insuranceManagedRuleCount,
  error
}: {
  feedback: SubmitFeedback;
  insuranceManagedRuleCount: number;
  error: unknown;
}) {
  return (
    <>
      {feedback?.severity === 'error' ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {insuranceManagedRuleCount > 0 ? (
        <Alert severity="info" variant="outlined">
          보험 계약과 연결된 반복 규칙이 {insuranceManagedRuleCount}건 있습니다.
          이런 규칙은 반복 규칙 화면에서 직접 수정하거나 삭제하지 않고{' '}
          <Link href="/insurances">보험 계약</Link> 화면에서 함께 관리합니다.
        </Alert>
      ) : null}
      {error ? (
        <QueryErrorAlert title="반복 규칙 조회에 실패했습니다." error={error} />
      ) : null}
    </>
  );
}

export function RecurringRulesToolbar({
  totalCount,
  activeCount,
  insuranceManagedRuleCount
}: {
  totalCount: number;
  activeCount: number;
  insuranceManagedRuleCount: number;
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
          label={`보험 연동 ${insuranceManagedRuleCount}건`}
          size="small"
          color={insuranceManagedRuleCount > 0 ? 'primary' : 'default'}
          variant="outlined"
        />
        <Chip
          label={`직접 관리 ${totalCount - insuranceManagedRuleCount}건`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        규칙은 목록에서 먼저 확인하고, 생성과 수정은 드로어에서 이어서
        처리합니다.
      </Typography>
    </Stack>
  );
}

export function RecurringRuleDrawerContent({
  mode,
  isPending,
  error,
  editingRecurringRule,
  onCompleted
}: {
  mode: 'create' | 'edit' | null;
  isPending: boolean;
  error: unknown;
  editingRecurringRule: ManagedRecurringRuleDetailItem | undefined;
  onCompleted: (
    recurringRule: ManagedRecurringRuleItem,
    mode: 'create' | 'edit'
  ) => void;
}) {
  if (mode === 'create') {
    return <RecurringRuleForm mode="create" onCompleted={onCompleted} />;
  }

  if (mode !== 'edit') {
    return null;
  }

  if (isPending) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          수정할 반복 규칙을 불러오고 있습니다.
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <QueryErrorAlert
        title="반복 규칙 상세 조회에 실패했습니다."
        error={error}
      />
    );
  }

  if (!editingRecurringRule) {
    return (
      <Alert severity="warning" variant="outlined">
        수정할 반복 규칙을 찾지 못했습니다.
      </Alert>
    );
  }

  if (editingRecurringRule.linkedInsurancePolicyId) {
    return (
      <Alert severity="info" variant="outlined">
        보험 계약에서 생성된 반복 규칙입니다. 수정은{' '}
        <Link href="/insurances">보험 계약</Link> 화면에서 진행해 주세요.
      </Alert>
    );
  }

  return (
    <RecurringRuleForm
      mode="edit"
      initialRule={editingRecurringRule}
      onCompleted={onCompleted}
    />
  );
}
