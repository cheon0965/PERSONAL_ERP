'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import { webRuntime } from '@/shared/config/env';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { TransactionForm } from './transaction-form';
import {
  collectedTransactionDetailQueryKey,
  collectedTransactionsQueryKey,
  confirmCollectedTransaction,
  deleteCollectedTransaction,
  getCollectedTransactionDetail,
  getCollectedTransactions,
  removeCollectedTransactionItem
} from './transactions.api';
import {
  CurrentPeriodSection,
  TransactionsFilterSection,
  TransactionsTableSection
} from './transactions-page.sections';
import {
  buildJournalEntryFallbackItem,
  isBusinessDateWithinPeriod
} from './transactions-page.shared';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type TransactionDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; transactionId: string }
  | null;

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');
  const [drawerState, setDrawerState] =
    React.useState<TransactionDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<CollectedTransactionItem | null>(null);

  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });
  const transactionsQuery = useQuery({
    queryKey: collectedTransactionsQueryKey,
    queryFn: getCollectedTransactions
  });
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
  });

  const editingTransactionId =
    drawerState?.mode === 'edit' ? drawerState.transactionId : null;
  const editingTransactionQuery = useQuery({
    queryKey: editingTransactionId
      ? collectedTransactionDetailQueryKey(editingTransactionId)
      : ['collected-transactions', 'detail-idle'],
    queryFn: () => getCollectedTransactionDetail(editingTransactionId ?? ''),
    enabled: Boolean(editingTransactionId)
  });

  const confirmMutation = useMutation({
    mutationFn: (transaction: CollectedTransactionItem) =>
      confirmCollectedTransaction(
        transaction.id,
        buildJournalEntryFallbackItem(transaction)
      ),
    onSuccess: async (createdEntry) => {
      setFeedback({
        severity: 'success',
        message: `${createdEntry.entryNumber} 전표를 생성하고 수집 거래를 확정했습니다.`
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        }),
        queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '수집 거래를 전표로 확정하지 못했습니다.'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (transaction: CollectedTransactionItem) =>
      deleteCollectedTransaction(transaction.id),
    onSuccess: async (_response, transaction) => {
      setDeleteTarget(null);
      setFeedback({
        severity: 'success',
        message: `${transaction.title} 수집 거래를 삭제했습니다.`
      });

      queryClient.setQueryData<CollectedTransactionItem[]>(
        collectedTransactionsQueryKey,
        (current) => removeCollectedTransactionItem(current, transaction.id)
      );
      queryClient.removeQueries({
        queryKey: collectedTransactionDetailQueryKey(transaction.id)
      });

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: collectedTransactionsQueryKey
          }),
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
            : '수집 거래를 삭제하지 못했습니다.'
      });
    }
  });

  const data = React.useMemo(
    () => transactionsQuery.data ?? [],
    [transactionsQuery.data]
  );
  const journalEntriesById = React.useMemo(
    () =>
      new Map(
        (journalEntriesQuery.data ?? []).map(
          (entry) => [entry.id, entry] as const
        )
      ),
    [journalEntriesQuery.data]
  );
  const currentPeriod = currentPeriodQuery.data ?? null;

  useDomainHelp({
    title: '수집 거래 개요',
    description:
      '수집 거래는 최종 회계 결과가 아니라, 현재 운영 월 안에서 검토되고 전표로 이어지는 중간 단계입니다. 보류 상태 거래는 이 화면에서 직접 수정, 삭제하거나 전표로 확정할 수 있습니다.',
    primaryEntity: '수집 거래',
    relatedEntities: [
      '운영 월',
      '거래 유형',
      '입출금 계정',
      '거래 분류',
      '전표'
    ],
    truthSource:
      '공식 회계 기준은 전표이며, 수집 거래는 전표 확정 전 단계의 운영 기록입니다.',
    readModelNote: currentPeriod
      ? `${currentPeriod.monthLabel} 운영 기간 안의 거래를 검토하고, 아직 전표가 없는 보류 상태 거래만 수정, 삭제하거나 확정할 수 있습니다.`
      : '아직 열린 운영 기간이 없어 수집 거래 등록과 전표 확정이 잠겨 있습니다.'
  });

  const fundingAccountOptions = React.useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.fundingAccountName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [data]
  );
  const categoryOptions = React.useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.categoryName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [data]
  );

  const filteredTransactions = React.useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return data.filter((item) => {
      const matchesCurrentPeriod =
        !currentPeriod ||
        isBusinessDateWithinPeriod(item.businessDate, currentPeriod);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [item.title, item.categoryName, item.fundingAccountName]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      const matchesFundingAccount =
        fundingAccountName.length === 0 ||
        item.fundingAccountName === fundingAccountName;
      const matchesCategory =
        categoryName.length === 0 || item.categoryName === categoryName;

      return (
        matchesCurrentPeriod &&
        matchesKeyword &&
        matchesFundingAccount &&
        matchesCategory
      );
    });
  }, [categoryName, currentPeriod, data, fundingAccountName, keyword]);

  const handleConfirmTransaction = React.useCallback(
    (transaction: CollectedTransactionItem) => {
      setFeedback(null);
      void confirmMutation.mutateAsync(transaction);
    },
    [confirmMutation]
  );

  const handleCreateOpen = React.useCallback(() => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }, []);

  const handleEditOpen = React.useCallback(
    (transaction: CollectedTransactionItem) => {
      setFeedback(null);
      setDrawerState({ mode: 'edit', transactionId: transaction.id });
    },
    []
  );

  const handleDeleteOpen = React.useCallback(
    (transaction: CollectedTransactionItem) => {
      setFeedback(null);
      setDeleteTarget(transaction);
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
    (transaction: CollectedTransactionItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      setFeedback({
        severity: 'success',
        message:
          mode === 'edit'
            ? `${transaction.title} 수집 거래를 수정했습니다.`
            : `${transaction.title} 수집 거래를 등록했습니다.`
      });
    },
    []
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '수집 거래 수정' : '수집 거래 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? currentPeriod
        ? `${currentPeriod.monthLabel} 운영 기간 안의 보류 상태 거래 내용을 수정합니다.`
        : '운영 기간이 열린 뒤에만 수집 거래를 수정할 수 있습니다.'
      : currentPeriod
        ? `${currentPeriod.monthLabel} 운영 기간 범위 안의 거래만 직접 등록할 수 있습니다.`
        : '운영 기간이 열린 뒤에만 수집 거래를 등록할 수 있습니다.';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="수집/확정"
        title="수집 거래"
        description="현재 열린 운영 월 안에서 사업 거래를 입력하고, 보류 상태 거래를 수정·삭제하거나 전표로 확정하는 화면입니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionOnClick={handleCreateOpen}
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {currentPeriodQuery.error ? (
        <QueryErrorAlert
          title="현재 운영 기간을 확인하지 못했습니다."
          error={currentPeriodQuery.error}
        />
      ) : null}
      {transactionsQuery.error ? (
        <QueryErrorAlert
          title="수집 거래 조회에 실패했습니다."
          error={transactionsQuery.error}
        />
      ) : null}
      {journalEntriesQuery.error ? (
        <QueryErrorAlert
          title="전표 연결 정보를 불러오지 못했습니다."
          error={journalEntriesQuery.error}
        />
      ) : null}

      <CurrentPeriodSection currentPeriod={currentPeriod} />

      <TransactionsFilterSection
        currentPeriod={currentPeriod}
        keyword={keyword}
        fundingAccountName={fundingAccountName}
        categoryName={categoryName}
        fundingAccountOptions={fundingAccountOptions}
        categoryOptions={categoryOptions}
        onKeywordChange={setKeyword}
        onFundingAccountChange={setFundingAccountName}
        onCategoryChange={setCategoryName}
      />

      <TransactionsTableSection
        currentPeriod={currentPeriod}
        rows={filteredTransactions}
        journalEntriesById={journalEntriesById}
        confirmPending={confirmMutation.isPending}
        confirmingTransactionId={confirmMutation.variables?.id}
        onConfirm={handleConfirmTransaction}
        onEdit={handleEditOpen}
        onDelete={handleDeleteOpen}
      />

      <FormDrawer
        open={drawerState !== null}
        onClose={handleDrawerClose}
        title={drawerTitle}
        description={drawerDescription}
      >
        {drawerState?.mode === 'edit' ? (
          editingTransactionQuery.isPending ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                수정할 수집 거래를 불러오고 있습니다.
              </Typography>
            </Stack>
          ) : editingTransactionQuery.error ? (
            <QueryErrorAlert
              title="수집 거래 상세 조회에 실패했습니다."
              error={editingTransactionQuery.error}
            />
          ) : editingTransactionQuery.data ? (
            <TransactionForm
              currentPeriod={currentPeriod}
              mode="edit"
              initialTransaction={editingTransactionQuery.data}
              onCompleted={handleFormCompleted}
            />
          ) : (
            <Alert severity="warning" variant="outlined">
              수정할 수집 거래를 찾지 못했습니다.
            </Alert>
          )
        ) : (
          <TransactionForm
            currentPeriod={currentPeriod}
            mode="create"
            onCompleted={handleFormCompleted}
          />
        )}
      </FormDrawer>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title="수집 거래 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" 수집 거래를 삭제할까요? 전표로 확정되지 않은 보류 상태 거래만 삭제할 수 있습니다.`
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
