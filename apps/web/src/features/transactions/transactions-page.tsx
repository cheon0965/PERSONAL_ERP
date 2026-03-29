'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  CollectedTransactionItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import { journalEntriesQueryKey } from '@/features/journal-entries/journal-entries.api';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { TransactionForm } from './transaction-form';
import {
  collectedTransactionsQueryKey,
  confirmCollectedTransaction,
  getCollectedTransactions
} from './transactions.api';

const sourceKindLabelMap: Record<string, string> = {
  MANUAL: '직접 입력',
  RECURRING: '반복 규칙 생성',
  IMPORT: '파일 업로드'
};

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });
  const transactionsQuery = useQuery({
    queryKey: collectedTransactionsQueryKey,
    queryFn: getCollectedTransactions
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
        queryClient.invalidateQueries({ queryKey: collectedTransactionsQueryKey }),
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
    truthSource: '공식 회계 기준은 전표이며, 수집 거래는 전표 확정 전 단계의 운영 기록입니다.',
    readModelNote: currentPeriod
      ? `${currentPeriod.monthLabel} 운영 기간 안의 거래를 검토하고, 아직 전표가 없는 보류 상태 거래만 확정할 수 있습니다.`
      : '아직 열린 운영 기간이 없어 수집 거래 등록과 전표 확정이 잠겨 있습니다.'
  });
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');

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
        !currentPeriod || isBusinessDateWithinPeriod(item.businessDate, currentPeriod);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [item.title, item.categoryName, item.fundingAccountName]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      const matchesFundingAccount =
        fundingAccountName.length === 0 || item.fundingAccountName === fundingAccountName;
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

  const columns = React.useMemo<GridColDef<CollectedTransactionItem>[]>(
    () => [
      { field: 'businessDate', headerName: '거래일', flex: 0.8 },
      { field: 'title', headerName: '수집 거래', flex: 1.4 },
      { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
      { field: 'categoryName', headerName: '카테고리', flex: 1 },
      {
        field: 'sourceKind',
        headerName: '수집 원천',
        flex: 0.8,
        valueFormatter: (value) =>
          sourceKindLabelMap[String(value)] ?? String(value)
      },
      {
        field: 'postingStatus',
        headerName: '전표 반영 상태',
        flex: 0.8,
        renderCell: (params) => <StatusChip label={String(params.value)} />
      },
      {
        field: 'amountWon',
        headerName: '금액',
        flex: 1,
        valueFormatter: (value) => formatWon(Number(value))
      },
      {
        field: 'actions',
        headerName: '동작',
        flex: 1.2,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
          const isConfirming =
            confirmMutation.isPending &&
            confirmMutation.variables?.id === row.id;

          if (row.postingStatus === 'PENDING') {
            return (
              <Button
                size="small"
                variant="contained"
                disabled={isConfirming}
                onClick={() => {
                  setFeedback(null);
                  void confirmMutation.mutateAsync(row);
                }}
              >
                {isConfirming ? '확정 중...' : '전표 확정'}
              </Button>
            );
          }

          if (row.postedJournalEntryId) {
            return (
              <Button
                size="small"
                component={Link}
                href={`/journal-entries?entryId=${row.postedJournalEntryId}`}
              >
                {row.postedJournalEntryNumber ?? '전표 보기'}
              </Button>
            );
          }

          return (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          );
        }
      }
    ],
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
      <SectionCard
        title="현재 운영 기간"
        description="수집 거래 입력과 전표 확정은 현재 열린 운영 기간 문맥 안에서만 진행됩니다."
      >
        {currentPeriod ? (
          <Grid container spacing={appLayout.fieldGap} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  상태
                </Typography>
                <div>
                  <StatusChip label={currentPeriod.status} />
                </div>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  운영 월
                </Typography>
                <Typography variant="body1">{currentPeriod.monthLabel}</Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  허용 거래일 범위
                </Typography>
                <Typography variant="body1">
                  {currentPeriod.startDate.slice(0, 10)} ~{' '}
                  {currentPeriod.endDate.slice(0, 10)}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 대상 월을
            시작해 주세요.
          </Typography>
        )}
      </SectionCard>

      <SectionCard
        title="필터"
        description={
          currentPeriod
            ? `${currentPeriod.monthLabel} 운영 기간의 수집 거래를 검색어, 자금수단, 카테고리 기준으로 좁혀 볼 수 있습니다.`
            : '운영 기간이 열리면 해당 기간의 수집 거래를 필터링할 수 있습니다.'
        }
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="검색어"
              size="small"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="자금수단"
              size="small"
              value={fundingAccountName}
              onChange={(event) => {
                setFundingAccountName(event.target.value);
              }}
            >
              <MenuItem value="">전체</MenuItem>
              {fundingAccountOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="카테고리"
              size="small"
              value={categoryName}
              onChange={(event) => {
                setCategoryName(event.target.value);
              }}
            >
              <MenuItem value="">전체</MenuItem>
              {categoryOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <DataTableCard
            title="수집 거래 목록"
            description={
              currentPeriod
                ? `${currentPeriod.monthLabel} 운영 기간 안의 수집 거래를 확인하고, 보류 상태 거래를 전표로 확정할 수 있습니다.`
                : '현재 열린 운영 기간이 없으므로 목록이 비어 있습니다.'
            }
            rows={currentPeriod ? filteredTransactions : []}
            columns={columns}
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

function isBusinessDateWithinPeriod(
  businessDate: string,
  currentPeriod: AccountingPeriodItem
): boolean {
  const businessTime = Date.parse(`${businessDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return businessTime >= startTime && businessTime < endTime;
}

function buildJournalEntryFallbackItem(
  transaction: CollectedTransactionItem
): JournalEntryItem {
  return {
    id: `je-demo-${transaction.id}`,
    entryNumber: 'DEMO',
    entryDate: `${transaction.businessDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: transaction.title,
    sourceCollectedTransactionId: transaction.id,
    sourceCollectedTransactionTitle: transaction.title,
    lines: []
  };
}
