'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { webRuntime } from '@/shared/config/env';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { StatusChip } from '@/shared/ui/status-chip';
import { RecurringRuleForm } from './recurring-rule-form';
import {
  deleteRecurringRule,
  getRecurringRuleDetail,
  getRecurringRules,
  type ManagedRecurringRuleItem,
  recurringRuleDetailQueryKey,
  recurringRulesQueryKey,
  removeRecurringRuleItem
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

type RecurringRuleDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; recurringRuleId: string }
  | null;

export function RecurringRulesPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<RecurringRuleDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ManagedRecurringRuleItem | null>(null);
  const { data = [], error } = useQuery({
    queryKey: recurringRulesQueryKey,
    queryFn: getRecurringRules
  });
  const insuranceManagedRuleCount = data.filter(
    (recurringRule) => recurringRule.linkedInsurancePolicyId
  ).length;

  const editingRecurringRuleId =
    drawerState?.mode === 'edit' ? drawerState.recurringRuleId : null;
  const editingRecurringRuleQuery = useQuery({
    queryKey: editingRecurringRuleId
      ? recurringRuleDetailQueryKey(editingRecurringRuleId)
      : ['recurring-rules', 'detail-idle'],
    queryFn: () => getRecurringRuleDetail(editingRecurringRuleId ?? ''),
    enabled: Boolean(editingRecurringRuleId)
  });

  const deleteMutation = useMutation({
    mutationFn: (recurringRule: ManagedRecurringRuleItem) =>
      deleteRecurringRule(recurringRule.id),
    onSuccess: async (_response, recurringRule) => {
      setDeleteTarget(null);
      setFeedback({
        severity: 'success',
        message: `${recurringRule.title} 반복 규칙을 삭제했습니다.`
      });

      queryClient.setQueryData<ManagedRecurringRuleItem[]>(
        recurringRulesQueryKey,
        (current) => removeRecurringRuleItem(current, recurringRule.id)
      );
      queryClient.removeQueries({
        queryKey: recurringRuleDetailQueryKey(recurringRule.id)
      });

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: recurringRulesQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ]);
      }
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '반복 규칙을 삭제하지 못했습니다.'
      });
    }
  });

  useDomainHelp({
    title: '반복 규칙 사용 가이드',
    description:
      '이 화면은 월세, 구독료, 정기 수입, 보험료처럼 반복되는 거래의 계획 기준을 관리하는 곳입니다. 규칙을 만들면 다음 단계에서 해당 월의 계획 항목으로 펼칠 수 있습니다.',
    primaryEntity: '반복 규칙',
    relatedEntities: [
      '계획 항목',
      '거래 유형',
      '입출금 계정',
      '거래 분류',
      '수집 거래'
    ],
    truthSource:
      '반복 규칙은 계획 생성 기준이며, 회계 확정은 이후 생성된 계획 항목의 연결 수집 거래와 전표에서 이뤄집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '반복 규칙 등록을 열고 제목, 금액, 주기, 시작일을 입력합니다.',
          '거래 성격에 맞는 자금수단과 카테고리를 선택해 계획 항목이 바로 전표 준비까지 이어지게 합니다.',
          '보험 계약 연동 규칙은 이 화면에서 직접 수정하지 않고 보험 계약 화면에서 관리합니다.',
          '중지한 규칙은 목록에 남지만 이후 계획 항목 생성 대상에서 빠집니다.',
          '규칙을 정리한 뒤 계획 항목 화면으로 이동해 선택한 운영 월의 계획을 생성합니다.'
        ]
      },
      {
        title: '주의할 점',
        items: [
          '반복 규칙을 삭제해도 이미 생성된 기존 계획 항목은 자동으로 지워지지 않습니다.',
          '규칙은 미래 계획의 기준이며, 실제 납부나 입금 여부는 수집 거래에서 확인합니다.',
          '카테고리나 자금수단 선택지가 부족하면 기준 데이터 관리 화면에서 먼저 보완합니다.'
        ]
      }
    ],
    readModelNote:
      '현재 목록은 앞으로 생성될 계획 항목의 기준을 보여줍니다. 공식 회계 숫자는 이 화면이 아니라 전표 조회와 재무제표에서 확인합니다.'
  });

  const handleCreateOpen = React.useCallback(() => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }, []);

  const handleEditOpen = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem) => {
      if (recurringRule.linkedInsurancePolicyId) {
        setFeedback({
          severity: 'error',
          message:
            '보험 계약에서 생성된 반복 규칙은 보험 계약 화면에서만 수정할 수 있습니다.'
        });
        return;
      }

      setFeedback(null);
      setDrawerState({ mode: 'edit', recurringRuleId: recurringRule.id });
    },
    []
  );

  const handleDeleteOpen = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem) => {
      if (recurringRule.linkedInsurancePolicyId) {
        setFeedback({
          severity: 'error',
          message:
            '보험 계약에서 생성된 반복 규칙은 보험 계약 화면에서만 삭제할 수 있습니다.'
        });
        return;
      }

      setFeedback(null);
      setDeleteTarget(recurringRule);
    },
    []
  );

  const handleDrawerClose = React.useCallback(() => {
    setDrawerState(null);
  }, []);

  const handleDeleteClose = React.useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    void deleteMutation.mutateAsync(deleteTarget);
  }, [deleteMutation, deleteTarget]);

  const handleFormCompleted = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      setFeedback({
        severity: 'success',
        message:
          mode === 'edit'
            ? `${recurringRule.title} 반복 규칙을 수정했습니다.`
            : `${recurringRule.title} 반복 규칙을 등록했습니다.`
      });
    },
    []
  );

  const columns = React.useMemo<GridColDef<ManagedRecurringRuleItem>[]>(
    () => [
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
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  handleEditOpen(params.row);
                }}
              >
                수정
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => {
                  handleDeleteOpen(params.row);
                }}
              >
                삭제
              </Button>
            </Stack>
          )
      }
    ],
    [handleDeleteOpen, handleEditOpen]
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '반복 규칙 수정' : '반복 규칙 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? '기존 계획 생성 기준을 수정하고 이후 계획 항목 생성 흐름에 반영합니다.'
      : '계획 생성 기준을 추가하고, 이후 계획 항목과 실제 거래 흐름으로 연결합니다.';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 기준"
        title="반복 규칙"
        description="반복 규칙은 월별 계획 항목을 만드는 기준이며, 실제 수집 거래와 전표와는 구분되는 계획 정보입니다."
        primaryActionLabel="반복 규칙 등록"
        primaryActionOnClick={handleCreateOpen}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={Link} href="/plan-items" variant="outlined">
          계획 항목 보기
        </Button>
      </Stack>

      {feedback ? (
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

      <DataTableCard
        title="계획 생성 규칙"
        description="각 규칙은 앞으로 생성될 계획 항목의 기준입니다. 필요하면 드로어에서 바로 수정하거나 삭제할 수 있습니다."
        rows={data}
        columns={columns}
      />

      <FormDrawer
        open={drawerState !== null}
        onClose={handleDrawerClose}
        title={drawerTitle}
        description={drawerDescription}
      >
        {drawerState?.mode === 'edit' ? (
          editingRecurringRuleQuery.isPending ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                수정할 반복 규칙을 불러오고 있습니다.
              </Typography>
            </Stack>
          ) : editingRecurringRuleQuery.error ? (
            <QueryErrorAlert
              title="반복 규칙 상세 조회에 실패했습니다."
              error={editingRecurringRuleQuery.error}
            />
          ) : editingRecurringRuleQuery.data ? (
            editingRecurringRuleQuery.data.linkedInsurancePolicyId ? (
              <Alert severity="info" variant="outlined">
                보험 계약에서 생성된 반복 규칙입니다. 수정은{' '}
                <Link href="/insurances">보험 계약</Link> 화면에서 진행해
                주세요.
              </Alert>
            ) : (
              <RecurringRuleForm
                mode="edit"
                initialRule={editingRecurringRuleQuery.data}
                onCompleted={handleFormCompleted}
              />
            )
          ) : (
            <Alert severity="warning" variant="outlined">
              수정할 반복 규칙을 찾지 못했습니다.
            </Alert>
          )
        ) : (
          <RecurringRuleForm mode="create" onCompleted={handleFormCompleted} />
        )}
      </FormDrawer>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title="반복 규칙 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" 반복 규칙을 삭제할까요? 기존 계획 항목은 남아 있고 이후 자동 생성 기준만 제거됩니다.`
            : ''
        }
        confirmLabel="삭제"
        pendingLabel="삭제 중..."
        confirmColor="error"
        busy={deleteMutation.isPending}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
      />
    </Stack>
  );
}
