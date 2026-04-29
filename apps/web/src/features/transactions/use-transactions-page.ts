'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import {
  accountingPeriodsQueryKey,
  currentAccountingPeriodQueryKey,
  getAccountingPeriods,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  readLatestCollectingAccountingPeriods,
  resolvePreferredAccountingPeriod
} from '@/features/accounting-periods/accounting-period-selection';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import {
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from '@/features/reference-data/reference-data.api';
import {
  buildErrorFeedback
} from '@/shared/api/fetch-json';
import { webRuntime } from '@/shared/config/env';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import {
  buildTransactionCompletedMessage,
  readTransactionDrawerDescription,
  readTransactionDrawerTitle
} from './transactions-page.commands';
import {
  buildCategoryOptions,
  buildFundingAccountOptions,
  filterTransactions,
  prioritizeVisibleTransactions
} from './transactions-page.filters';
import { buildJournalEntryFallbackItem } from './transactions-page.shared';
import {
  bulkConfirmCollectedTransactions,
  collectedTransactionDetailQueryKey,
  collectedTransactionsQueryKey,
  confirmCollectedTransaction,
  deleteCollectedTransaction,
  getCollectedTransactionDetail,
  getCollectedTransactions,
  removeCollectedTransactionItem
} from './transactions.api';
import { canConfirmCollectedTransaction } from './transaction-workflow';

type SubmitFeedback = FeedbackAlertValue;

type TransactionDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; transactionId: string }
  | null;

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * 수집 거래 화면의 서버 데이터, 필터, 선택 상태, 전표 확정 액션을 묶는 페이지 훅입니다.
 *
 * 이 화면은 수기 입력, 계획 생성, 업로드 승격으로 생긴 거래가 모이는 운영 허브입니다.
 * 그래서 거래 목록뿐 아니라 현재 운영월, 전표 목록, 기준정보 준비도까지 함께 읽어
 * "지금 처리할 수 있는 거래"와 "확정 후 갱신해야 할 캐시"를 한곳에서 관리합니다.
 */
export function useTransactionsPage() {
  const searchParams = useSearchParams();
  const highlightedTransactionId = searchParams?.get('transactionId') ?? null;
  const highlightedPlanItemId = searchParams?.get('planItemId') ?? null;
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');
  const [postingStatus, setPostingStatus] = React.useState('');
  const [drawerState, setDrawerState] =
    React.useState<TransactionDrawerState>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = React.useState<
    string[]
  >([]);
  const [deleteTarget, setDeleteTarget] =
    React.useState<CollectedTransactionItem | null>(null);

  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });
  const accountingPeriodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
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
      notifySuccess(
        `${createdEntry.entryNumber} 전표를 생성하고 수집 거래를 확정했습니다.`
      );

      // 확정 성공 시 수집 거래와 전표 목록을 함께 갱신해야 같은 화면에서 즉시 POSTED 흐름이 보입니다.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        }),
        queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey })
      ]);
    },
    onError: (error) => {
      setFeedback(
        buildErrorFeedback(error, '수집 거래를 전표로 확정하지 못했습니다.')
      );
    }
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: bulkConfirmCollectedTransactions,
    onSuccess: async (result) => {
      // 일괄 확정 후에는 실패 항목까지 재계산되므로 선택 상태를 비워 오래된 체크 상태를 남기지 않습니다.
      setSelectedTransactionIds([]);
      if (result.failedCount > 0) {
        setFeedback({
          severity: 'error',
          message: `${result.requestedCount}건 중 ${result.succeededCount}건을 확정했고 ${result.failedCount}건은 실패했습니다.`
        });
      } else {
        notifySuccess(`${result.succeededCount}건을 전표로 일괄 확정했습니다.`);
      }

      // 대시보드 요약도 전표 반영 여부에 의존하므로 거래/전표 캐시와 함께 무효화합니다.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        }),
        queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      ]);
    },
    onError: (error) => {
      setFeedback(
        buildErrorFeedback(
          error,
          '수집 거래를 일괄 전표 확정하지 못했습니다.'
        )
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (transaction: CollectedTransactionItem) =>
      deleteCollectedTransaction(transaction.id),
    onSuccess: async (_response, transaction) => {
      setDeleteTarget(null);
      notifySuccess(`${transaction.title} 수집 거래를 삭제했습니다.`);

      // 삭제 응답을 기다린 뒤 목록 캐시에서 먼저 제거해 데모/오프라인 대체 모드에서도 화면이 즉시 정리됩니다.
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
      setFeedback(buildErrorFeedback(error, '수집 거래를 삭제하지 못했습니다.'));
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
  const accountingPeriods = accountingPeriodsQuery.data ?? [];
  const collectingPeriods = React.useMemo(
    () => readLatestCollectingAccountingPeriods(accountingPeriods),
    [accountingPeriods]
  );
  const preferredCollectingPeriod = React.useMemo(
    () => resolvePreferredAccountingPeriod(currentPeriod, collectingPeriods),
    [collectingPeriods, currentPeriod]
  );

  useDomainHelp({
    title: '수집 거래 사용 가이드',
    description:
      '이 화면은 현재 운영 월을 기본 기준으로 실제 거래 후보를 검토하고 전표로 확정하는 핵심 작업 화면입니다. 수기 입력, 업로드 행 등록, 계획 항목에서 생성된 거래가 모두 이곳에 모입니다.',
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
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '운영 월 카드에서 거래일 허용 범위를 먼저 확인합니다.',
          '필터로 자금수단, 카테고리, 전표 반영 상태를 좁혀 처리할 거래를 찾습니다.',
          '수기 거래는 수집 거래 등록으로 입력하고, 업로드나 계획에서 넘어온 거래는 목록에서 수정으로 보완합니다.',
          '손익 거래는 카테고리가 채워져야 전표 준비 상태가 됩니다. 이체 거래는 카테고리 없이도 전표 준비 상태가 될 수 있습니다.',
          '전표 준비 상태가 되면 행의 전표 확정을 누르거나 여러 행을 선택해 선택 전표 확정으로 한 번에 JournalEntry를 생성합니다.'
        ]
      },
      {
        title: '목록 조작 팁',
        items: [
          '검색어는 제목, 메모, 자금수단, 카테고리를 함께 좁히는 빠른 찾기용으로 사용합니다.',
          '체크박스 선택은 현재 필터에 보이는 거래 기준으로 유지되며, 필터를 바꿔 화면에서 사라진 거래는 일괄 확정 대상에서 빠집니다.',
          '강조 표시된 거래나 계획 항목이 있으면 다른 화면에서 이어 온 작업이므로 해당 행의 상태와 연결 정보를 먼저 확인합니다.'
        ]
      },
      {
        title: '상태별 처리',
        items: [
          '수집 또는 검토 상태는 수정해서 자금수단/카테고리/메모를 보완합니다.',
          '전표 준비 상태는 확정 버튼으로 공식 전표를 생성합니다.',
          'POSTED, CORRECTED, LOCKED처럼 이미 전표 흐름에 들어간 거래는 삭제로 되돌리지 않고 전표 조회에서 반전 또는 정정합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '전표 조회',
            description:
              '확정된 거래가 어떤 차변·대변 라인으로 반영됐는지 확인하고 필요하면 반전/정정을 진행합니다.',
            href: '/journal-entries',
            actionLabel: '전표 보기'
          },
          {
            title: '업로드 배치',
            description:
              '은행 파일이나 붙여넣기 원본에서 아직 등록하지 않은 행을 계속 처리합니다.',
            href: '/imports',
            actionLabel: '업로드 배치 보기'
          },
          {
            title: '계획 항목',
            description:
              '거래와 연결된 월 계획의 초안, 연결, 확정 상태를 다시 확인합니다.',
            href: '/plan-items',
            actionLabel: '계획 항목 보기'
          }
        ]
      }
    ],
    readModelNote: preferredCollectingPeriod
      ? `${preferredCollectingPeriod.monthLabel} 최신 진행월의 거래를 검토하고, 아직 전표가 없는 수집·검토·전표 준비 상태 거래만 수정하거나 삭제할 수 있습니다. 전표 확정은 전표 준비 상태에서만 가능합니다.`
      : '아직 열린 운영 기간이 없어 수집 거래 등록과 전표 확정이 잠겨 있습니다.'
  });

  const fundingAccountOptions = React.useMemo(
    () => buildFundingAccountOptions(data),
    [data]
  );
  const categoryOptions = React.useMemo(
    () => buildCategoryOptions(data),
    [data]
  );
  const filteredTransactions = React.useMemo(
    () =>
      // 최신 진행월 범위와 화면 필터를 함께 적용해 확정 가능한 후보를 유지보수자가 한곳에서 추적할 수 있게 합니다.
      filterTransactions({
        data,
        collectingPeriods,
        keyword,
        fundingAccountName,
        categoryName,
        postingStatus
      }),
    [
      categoryName,
      collectingPeriods,
      data,
      fundingAccountName,
      keyword,
      postingStatus
    ]
  );
  const visibleTransactions = React.useMemo(
    () =>
      prioritizeVisibleTransactions({
        filteredTransactions,
        highlightedTransactionId,
        highlightedPlanItemId
      }),
    [filteredTransactions, highlightedPlanItemId, highlightedTransactionId]
  );
  const visibleConfirmableTransactions = React.useMemo(
    () => visibleTransactions.filter(canConfirmCollectedTransaction),
    [visibleTransactions]
  );
  const selectedTransactions = React.useMemo(
    () =>
      visibleTransactions.filter((transaction) =>
        selectedTransactionIds.includes(transaction.id)
      ),
    [selectedTransactionIds, visibleTransactions]
  );
  const selectedConfirmableTransactions = React.useMemo(
    () => selectedTransactions.filter(canConfirmCollectedTransaction),
    [selectedTransactions]
  );

  React.useEffect(() => {
    setSelectedTransactionIds((current) => {
      // 필터 변경이나 상태 변경으로 화면에서 사라진 거래는 일괄 확정 대상에서도 즉시 제외합니다.
      const next = current.filter((transactionId) =>
        visibleTransactions.some(
          (transaction) =>
            transaction.id === transactionId &&
            canConfirmCollectedTransaction(transaction)
        )
      );

      return areStringArraysEqual(current, next) ? current : next;
    });
  }, [visibleTransactions]);

  function openCreateDrawer() {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }

  function openEditDrawer(transaction: CollectedTransactionItem) {
    setFeedback(null);
    setDrawerState({ mode: 'edit', transactionId: transaction.id });
  }

  function openDeleteDialog(transaction: CollectedTransactionItem) {
    setFeedback(null);
    setDeleteTarget(transaction);
  }

  function closeDrawer() {
    setDrawerState(null);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  function clearFilters() {
    setKeyword('');
    setFundingAccountName('');
    setCategoryName('');
    setPostingStatus('');
  }

  function confirmTransaction(transaction: CollectedTransactionItem) {
    setFeedback(null);
    void confirmMutation.mutateAsync(transaction);
  }

  function bulkConfirmTransactions() {
    const hasSelection = selectedTransactionIds.length > 0;
    const targetTransactions = hasSelection
      ? selectedConfirmableTransactions
      : visibleConfirmableTransactions;

    if (targetTransactions.length === 0) {
      setFeedback({
        severity: 'error',
        message: hasSelection
          ? '선택한 거래 중 전표 준비 상태가 없습니다.'
          : '현재 목록에 전표 준비 상태 거래가 없습니다.'
      });
      return;
    }

    const confirmed = window.confirm(
      `${targetTransactions.length}건의 수집 거래를 전표로 일괄 확정할까요?`
    );

    if (!confirmed) {
      return;
    }

    setFeedback(null);
    void bulkConfirmMutation.mutateAsync({
      transactionIds: targetTransactions.map((transaction) => transaction.id)
    });
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setFeedback(null);
    void deleteMutation.mutateAsync(deleteTarget);
  }

  function handleFormCompleted(
    transaction: CollectedTransactionItem,
    mode: 'create' | 'edit'
  ) {
    setDrawerState(null);
    notifySuccess(buildTransactionCompletedMessage(transaction, mode));
  }

  return {
    categoryName,
    categoryOptions,
    accountingPeriods,
    accountingPeriodsQuery,
    collectingPeriods,
    closeDeleteDialog,
    closeDrawer,
    clearFilters,
    bulkConfirmPending: bulkConfirmMutation.isPending,
    bulkConfirmTransactions,
    confirmDelete,
    confirmPending: confirmMutation.isPending,
    confirmTransaction,
    confirmingTransactionId: confirmMutation.variables?.id,
    currentPeriod,
    currentPeriodQuery,
    deletePending: deleteMutation.isPending,
    deleteTarget,
    drawerDescription: readTransactionDrawerDescription({
      drawerMode: drawerState?.mode ?? null,
      currentPeriod: preferredCollectingPeriod,
      hasMultipleCollectingPeriods: false
    }),
    drawerOpen: drawerState !== null,
    drawerState,
    drawerTitle: readTransactionDrawerTitle(drawerState?.mode ?? null),
    editingTransactionQuery,
    feedback,
    fundingAccountName,
    fundingAccountOptions,
    handleFormCompleted,
    highlightedPlanItemId,
    highlightedTransactionId,
    journalEntriesById,
    journalEntriesQuery,
    keyword,
    openCreateDrawer,
    openDeleteDialog,
    openEditDrawer,
    postingStatus,
    referenceDataReadinessQuery,
    selectedConfirmableTransactionCount: selectedConfirmableTransactions.length,
    selectedTransactionIds,
    selectedTransactionsCount: selectedTransactions.length,
    setCategoryName,
    setFundingAccountName,
    setKeyword,
    setPostingStatus,
    setSelectedTransactionIds,
    transactionsQuery,
    visibleConfirmableTransactionCount: visibleConfirmableTransactions.length,
    visibleTransactions
  };
}
