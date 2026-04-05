'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import {
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from '@/features/reference-data/reference-data.api';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { webRuntime } from '@/shared/config/env';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { resolveStatusLabel } from '@/shared/ui/status-chip';
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
  const searchParams = useSearchParams();
  const highlightedTransactionId = searchParams?.get('transactionId') ?? null;
  const highlightedPlanItemId = searchParams?.get('planItemId') ?? null;
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');
  const [postingStatus, setPostingStatus] = React.useState('');
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
  const referenceDataReadinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
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
      '수집 거래는 최종 회계 결과가 아니라, 현재 운영 월 안에서 수집되고 검토되어 전표로 이어지는 중간 단계입니다. 이 화면에서는 수집, 검토, 전표 준비 상태를 구분해 보고 필요한 보완 뒤 전표로 확정할 수 있습니다.',
    primaryEntity: '수집 거래',
    relatedEntities: [
      '운영 월',
      '거래 유형',
      '자금수단 계정',
      '거래 분류',
      '전표'
    ],
    truthSource:
      '공식 회계 기준은 전표이되, 수집 거래는 전표 확정 전 단계의 운영 기록입니다.',
    readModelNote: currentPeriod
      ? `${currentPeriod.monthLabel} 운영 기간 안의 거래를 검토하고, 아직 전표가 없는 수집·검토·전표 준비 상태 거래만 수정하거나 삭제할 수 있습니다. 전표 확정은 전표 준비 상태에서만 가능합니다.`
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
      const matchesPostingStatus =
        postingStatus.length === 0 || item.postingStatus === postingStatus;

      return (
        matchesCurrentPeriod &&
        matchesKeyword &&
        matchesFundingAccount &&
        matchesCategory &&
        matchesPostingStatus
      );
    });
  }, [
    categoryName,
    currentPeriod,
    data,
    fundingAccountName,
    keyword,
    postingStatus
  ]);
  const visibleTransactions = React.useMemo(() => {
    if (highlightedTransactionId) {
      const highlighted = filteredTransactions.find(
        (item) => item.id === highlightedTransactionId
      );

      if (highlighted) {
        return [
          highlighted,
          ...filteredTransactions.filter((item) => item.id !== highlighted.id)
        ];
      }
    }

    if (highlightedPlanItemId) {
      const linked = filteredTransactions.filter(
        (item) => item.matchedPlanItemId === highlightedPlanItemId
      );

      if (linked.length > 0) {
        return [
          ...linked,
          ...filteredTransactions.filter(
            (item) => item.matchedPlanItemId !== highlightedPlanItemId
          )
        ];
      }
    }

    return filteredTransactions;
  }, [filteredTransactions, highlightedPlanItemId, highlightedTransactionId]);

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
            ? `${transaction.title} 수집 거래를 수정했고 ${resolveStatusLabel(transaction.postingStatus)} 상태로 반영했습니다.`
            : `${transaction.title} 수집 거래를 등록했고 ${resolveStatusLabel(transaction.postingStatus)} 상태로 반영했습니다.`
      });
    },
    []
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '수집 거래 수정' : '수집 거래 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? currentPeriod
        ? `${currentPeriod.monthLabel} 운영 기간 안의 미확정 거래 내용을 수정합니다. 저장 결과는 검토 또는 전표 준비 상태로 다시 계산됩니다.`
        : '운영 기간이 열린 월에만 수집 거래를 수정할 수 있습니다.'
      : currentPeriod
        ? `${currentPeriod.monthLabel} 운영 기간 범위 안의 거래만 직접 등록할 수 있습니다. 저장 즉시 검토 또는 전표 준비 상태로 분류됩니다.`
        : '운영 기간이 열린 월에만 수집 거래를 등록할 수 있습니다.';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="수집/확정"
        title="수집 거래"
        description="현재 열린 운영 월 안에서 사업 거래를 입력하고, 수집·검토·전표 준비 상태를 구분해 보완한 뒤 전표로 확정하는 화면입니다. 원계획과 전표 연결도 함께 추적합니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionOnClick={handleCreateOpen}
      />

      {highlightedTransactionId || highlightedPlanItemId ? (
        <Alert severity="info" variant="outlined">
          다른 화면에서 연결된 수집 거래 맥락을 열었습니다. 관련 거래를 목록 상단에
          먼저 배치했습니다.
        </Alert>
      ) : null}
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
      <ReferenceDataReadinessAlert
        readiness={referenceDataReadinessQuery.data ?? null}
        context="transaction-entry"
      />
      {referenceDataReadinessQuery.data &&
      !referenceDataReadinessQuery.data.isReadyForTransactionEntry ? (
        <Alert severity="info" variant="outlined">
          기준 데이터 준비가 완전하지 않은 상태에서도 기존 수집 거래는 확인할
          수 있지만, 새 입력과 다음 확정 흐름은 제한될 수 있습니다.{' '}
          <Button component={Link} href="/reference-data" size="small">
            기준 데이터 화면으로 이동
          </Button>
        </Alert>
      ) : null}

      <CurrentPeriodSection currentPeriod={currentPeriod} />

      <TransactionsFilterSection
        currentPeriod={currentPeriod}
        keyword={keyword}
        fundingAccountName={fundingAccountName}
        categoryName={categoryName}
        postingStatus={postingStatus}
        fundingAccountOptions={fundingAccountOptions}
        categoryOptions={categoryOptions}
        onKeywordChange={setKeyword}
        onFundingAccountChange={setFundingAccountName}
        onCategoryChange={setCategoryName}
        onPostingStatusChange={setPostingStatus}
      />

      <TransactionsTableSection
        currentPeriod={currentPeriod}
        rows={visibleTransactions}
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
            ? `"${deleteTarget.title}" 수집 거래를 삭제할까요? 전표로 확정되지 않은 수집·검토·전표 준비 상태 거래만 삭제할 수 있습니다.`
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
