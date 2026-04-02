'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { RecurringRuleItem } from '@personal-erp/contracts';
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
    React.useState<RecurringRuleItem | null>(null);
  const { data = [], error } = useQuery({
    queryKey: recurringRulesQueryKey,
    queryFn: getRecurringRules
  });

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
    mutationFn: (recurringRule: RecurringRuleItem) =>
      deleteRecurringRule(recurringRule.id),
    onSuccess: async (_response, recurringRule) => {
      setDeleteTarget(null);
      setFeedback({
        severity: 'success',
        message: `${recurringRule.title} 반복 규칙을 삭제했습니다.`
      });

      queryClient.setQueryData<RecurringRuleItem[]>(
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
    title: '반복 규칙 개요',
    description:
      '반복 규칙 화면은 계획 데이터의 입력 영역입니다. 미래 일정과 금액 기준을 정의하지만, 이 화면 자체가 공식 회계 대상을 만들지는 않습니다.',
    primaryEntity: '반복 규칙',
    relatedEntities: [
      '계획 항목',
      '거래 유형',
      '입출금 계정',
      '거래 분류',
      '수집 거래'
    ],
    truthSource:
      '반복 규칙과 계획 항목은 계획 기준이며, 회계 확정은 이후 수집 거래와 전표에서 이뤄집니다.',
    readModelNote:
      '현재 목록은 앞으로 생성될 계획 항목의 기준을 보여주는 운영 화면입니다.'
  });

  const handleCreateOpen = React.useCallback(() => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }, []);

  const handleEditOpen = React.useCallback((recurringRule: RecurringRuleItem) => {
    setFeedback(null);
    setDrawerState({ mode: 'edit', recurringRuleId: recurringRule.id });
  }, []);

  const handleDeleteOpen = React.useCallback((recurringRule: RecurringRuleItem) => {
    setFeedback(null);
    setDeleteTarget(recurringRule);
  }, []);

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
    (recurringRule: RecurringRuleItem, mode: 'create' | 'edit') => {
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

  const columns = React.useMemo<GridColDef<RecurringRuleItem>[]>(
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
        valueFormatter: (value) => frequencyLabelMap[String(value)] ?? String(value)
      },
      {
        field: 'nextRunDate',
        headerName: '다음 실행일',
        flex: 1,
        valueFormatter: (value) =>
          value ? formatDate(String(value)) : '-'
      },
      { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
      { field: 'categoryName', headerName: '카테고리', flex: 1 },
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
        renderCell: (params) => (
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
            <RecurringRuleForm
              mode="edit"
              initialRule={editingRecurringRuleQuery.data}
              onCompleted={handleFormCompleted}
            />
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
