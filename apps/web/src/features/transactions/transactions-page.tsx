'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Grid, Stack } from '@mui/material';
import type {
  CollectedTransactionItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from '@/features/journal-entries/journal-entries.api';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { TransactionForm } from './transaction-form';
import {
  collectedTransactionsQueryKey,
  confirmCollectedTransaction,
  getCollectedTransactions
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

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');

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
      '수집 거래는 회계적 진실의 최종 원천이 아니라, 현재 운영 기간 안에서 검토되고 전표로 이어지는 중간 단계입니다. 이번 라운드부터는 보류 상태 수집 거래를 직접 JournalEntry로 확정할 수 있습니다.',
    primaryEntity: '수집 거래 (CollectedTransaction)',
    relatedEntities: [
      '운영 기간 (AccountingPeriod)',
      '거래 유형 (TransactionType)',
      '자금수단 (FundingAccount)',
      '카테고리 (Category)',
      '전표 (JournalEntry)'
    ],
    truthSource:
      '공식 회계 기준은 전표이며, 수집 거래는 전표 확정 전 단계의 운영 기록입니다.',
    readModelNote: currentPeriod
      ? `${currentPeriod.monthLabel} 운영 기간 안의 거래를 검토하고, 아직 전표가 없는 보류 상태 거래만 확정할 수 있습니다.`
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

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="수집/확정"
        title="수집 거래"
        description="현재 열린 AccountingPeriod 안에서 수집 거래를 입력하고, 보류 상태 거래를 최소 전표로 확정하는 화면입니다. 이번 단계에서는 수입/지출 거래 1건을 전표 1건으로 연결하는 얇은 흐름에 집중합니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionHref="#collected-transaction-form"
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

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <TransactionsTableSection
            currentPeriod={currentPeriod}
            rows={filteredTransactions}
            journalEntriesById={journalEntriesById}
            confirmPending={confirmMutation.isPending}
            confirmingTransactionId={confirmMutation.variables?.id}
            onConfirm={handleConfirmTransaction}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <div id="collected-transaction-form">
            <SectionCard
              title="수집 거래 등록"
              description={
                currentPeriod
                  ? `${currentPeriod.monthLabel} 운영 기간 범위 안의 거래만 직접 등록할 수 있습니다.`
                  : '운영 기간이 열린 뒤에만 수집 거래를 등록할 수 있습니다.'
              }
            >
              <TransactionForm currentPeriod={currentPeriod} />
            </SectionCard>
          </div>
        </Grid>
      </Grid>
    </Stack>
  );
}
