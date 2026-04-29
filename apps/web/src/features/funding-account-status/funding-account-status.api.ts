import type {
  FundingAccountOverviewAccountItem,
  FundingAccountOverviewBasis,
  FundingAccountOverviewResponse,
  FundingAccountOverviewTotals,
  FundingAccountOverviewTransactionItem
} from '@personal-erp/contracts';
import { sumMoneyWon } from '@personal-erp/money';
import { fetchJson } from '@/shared/api/fetch-json';

export type GetFundingAccountStatusSummaryInput = {
  basis?: FundingAccountOverviewBasis;
  periodId?: string | null;
  fundingAccountId?: string | null;
};

export const fundingAccountStatusQueryKey = (
  input: GetFundingAccountStatusSummaryInput
) =>
  [
    'funding-account-status',
    input.basis ?? 'COLLECTED_TRANSACTIONS',
    input.periodId ?? 'auto',
    input.fundingAccountId ?? 'all'
  ] as const;

export function getFundingAccountStatusSummary(
  input: GetFundingAccountStatusSummaryInput = {}
) {
  const params = new URLSearchParams();

  if (input.basis) {
    params.set('basis', input.basis);
  }

  if (input.periodId) {
    params.set('periodId', input.periodId);
  }

  if (input.fundingAccountId) {
    params.set('fundingAccountId', input.fundingAccountId);
  }

  const query = params.toString();

  return fetchJson<FundingAccountOverviewResponse | null>(
    `/funding-account-status/summary${query ? `?${query}` : ''}`,
    buildFundingAccountStatusFallback(input)
  );
}

const mockAccounts: FundingAccountOverviewAccountItem[] = [
  {
    id: 'funding-demo-bank',
    name: '주거래 통장',
    type: 'BANK',
    status: 'ACTIVE',
    bootstrapStatus: 'COMPLETED',
    openingBalanceWon: 1_820_000,
    liveBalanceWon: 2_260_000,
    basisClosingBalanceWon: 2_480_000,
    incomeWon: 3_200_000,
    expenseWon: 2_010_000,
    transferInWon: 260_000,
    transferOutWon: 790_000,
    netFlowWon: 660_000,
    remainingPlannedIncomeWon: 0,
    remainingPlannedExpenseWon: 280_000,
    expectedClosingBalanceWon: 2_200_000,
    transactionCount: 18,
    pendingTransactionCount: 3,
    postedTransactionCount: 15,
    lastActivityOn: '2026-03-27'
  },
  {
    id: 'funding-demo-card',
    name: '생활비 카드',
    type: 'CARD',
    status: 'ACTIVE',
    bootstrapStatus: 'NOT_REQUIRED',
    openingBalanceWon: -420_000,
    liveBalanceWon: -620_000,
    basisClosingBalanceWon: -720_000,
    incomeWon: 0,
    expenseWon: 940_000,
    transferInWon: 420_000,
    transferOutWon: 0,
    netFlowWon: -520_000,
    remainingPlannedIncomeWon: 0,
    remainingPlannedExpenseWon: 180_000,
    expectedClosingBalanceWon: -900_000,
    transactionCount: 11,
    pendingTransactionCount: 2,
    postedTransactionCount: 9,
    lastActivityOn: '2026-03-26'
  },
  {
    id: 'funding-demo-cash',
    name: '현금 보관',
    type: 'CASH',
    status: 'ACTIVE',
    bootstrapStatus: 'COMPLETED',
    openingBalanceWon: 150_000,
    liveBalanceWon: 120_000,
    basisClosingBalanceWon: 95_000,
    incomeWon: 40_000,
    expenseWon: 65_000,
    transferInWon: 0,
    transferOutWon: 30_000,
    netFlowWon: -55_000,
    remainingPlannedIncomeWon: 0,
    remainingPlannedExpenseWon: 25_000,
    expectedClosingBalanceWon: 70_000,
    transactionCount: 5,
    pendingTransactionCount: 0,
    postedTransactionCount: 5,
    lastActivityOn: '2026-03-21'
  }
];

const mockTransactions: FundingAccountOverviewTransactionItem[] = [
  {
    id: 'funding-tx-1',
    businessDate: '2026-03-27',
    title: '급여 입금',
    fundingAccountId: 'funding-demo-bank',
    fundingAccountName: '주거래 통장',
    flowKind: 'INCOME',
    amountWon: 3_200_000,
    categoryName: '급여',
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    journalEntryId: 'journal-demo-1',
    journalEntryNumber: 'JE-202603-0018'
  },
  {
    id: 'funding-tx-2',
    businessDate: '2026-03-25',
    title: '생활비 카드 결제',
    fundingAccountId: 'funding-demo-bank',
    fundingAccountName: '주거래 통장',
    flowKind: 'TRANSFER',
    amountWon: 420_000,
    categoryName: '카드대금',
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    journalEntryId: 'journal-demo-2',
    journalEntryNumber: 'JE-202603-0017'
  },
  {
    id: 'funding-tx-3',
    businessDate: '2026-03-23',
    title: '마트 장보기',
    fundingAccountId: 'funding-demo-card',
    fundingAccountName: '생활비 카드',
    flowKind: 'EXPENSE',
    amountWon: 156_000,
    categoryName: '식비',
    status: 'READY_TO_POST',
    sourceKind: 'COLLECTED_TRANSACTION',
    journalEntryId: null,
    journalEntryNumber: null
  },
  {
    id: 'funding-tx-4',
    businessDate: '2026-03-21',
    title: '현금 교통비',
    fundingAccountId: 'funding-demo-cash',
    fundingAccountName: '현금 보관',
    flowKind: 'EXPENSE',
    amountWon: 25_000,
    categoryName: '교통',
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    journalEntryId: 'journal-demo-3',
    journalEntryNumber: 'JE-202603-0012'
  },
  {
    id: 'funding-tx-5',
    businessDate: '2026-03-18',
    title: '보험료 자동이체',
    fundingAccountId: 'funding-demo-bank',
    fundingAccountName: '주거래 통장',
    flowKind: 'EXPENSE',
    amountWon: 280_000,
    categoryName: '보험료',
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    journalEntryId: 'journal-demo-4',
    journalEntryNumber: 'JE-202603-0009'
  }
];

function buildFundingAccountStatusFallback(
  input: GetFundingAccountStatusSummaryInput
): FundingAccountOverviewResponse {
  const basis = input.basis ?? 'COLLECTED_TRANSACTIONS';
  const selectedFundingAccountId = mockAccounts.some(
    (account) => account.id === input.fundingAccountId
  )
    ? (input.fundingAccountId ?? null)
    : null;
  const scopedAccounts = selectedFundingAccountId
    ? mockAccounts.filter((account) => account.id === selectedFundingAccountId)
    : mockAccounts;
  const scopedTransactions = mockTransactions.filter(
    (transaction) =>
      !selectedFundingAccountId ||
      transaction.fundingAccountId === selectedFundingAccountId
  );

  return {
    period: {
      id: input.periodId ?? 'period-demo-live',
      year: 2026,
      month: 3,
      monthLabel: '2026-03',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      status: 'OPEN',
      openedAt: '2026-03-01T00:00:00.000Z',
      lockedAt: null,
      hasOpeningBalanceSnapshot: true,
      openingBalanceSourceKind: 'CARRY_FORWARD',
      statusHistory: []
    },
    basis,
    selectedFundingAccountId,
    totals: buildTotals(scopedAccounts),
    accounts: mockAccounts,
    trend: [
      {
        periodId: 'period-demo-1',
        monthLabel: '2025-12',
        periodStatus: 'LOCKED',
        incomeWon: 3_080_000,
        expenseWon: 1_980_000,
        netFlowWon: 1_100_000,
        closingBalanceWon: 1_760_000,
        isOfficial: true
      },
      {
        periodId: 'period-demo-2',
        monthLabel: '2026-01',
        periodStatus: 'LOCKED',
        incomeWon: 3_150_000,
        expenseWon: 2_080_000,
        netFlowWon: 1_070_000,
        closingBalanceWon: 2_120_000,
        isOfficial: true
      },
      {
        periodId: 'period-demo-3',
        monthLabel: '2026-02',
        periodStatus: 'LOCKED',
        incomeWon: 3_180_000,
        expenseWon: 2_220_000,
        netFlowWon: 960_000,
        closingBalanceWon: 2_390_000,
        isOfficial: true
      },
      {
        periodId: 'period-demo-live',
        monthLabel: '2026-03',
        periodStatus: 'OPEN',
        incomeWon: buildTotals(scopedAccounts).incomeWon,
        expenseWon: buildTotals(scopedAccounts).expenseWon,
        netFlowWon: buildTotals(scopedAccounts).netFlowWon,
        closingBalanceWon: buildTotals(scopedAccounts).basisClosingBalanceWon,
        isOfficial: false
      }
    ],
    categoryBreakdown: [
      {
        categoryName: '식비',
        flowKind: 'EXPENSE',
        amountWon: 420_000,
        transactionCount: 5
      },
      {
        categoryName: '보험료',
        flowKind: 'EXPENSE',
        amountWon: 280_000,
        transactionCount: 1
      },
      {
        categoryName: '교통',
        flowKind: 'EXPENSE',
        amountWon: 95_000,
        transactionCount: 4
      },
      {
        categoryName: '급여',
        flowKind: 'INCOME',
        amountWon: 3_200_000,
        transactionCount: 1
      }
    ],
    transactions: scopedTransactions,
    warnings:
      basis === 'POSTED_JOURNALS'
        ? [
            '현재 기간은 잠금 전이므로 확정 전표 기준 수치는 POSTED 전표만 반영합니다.'
          ]
        : [
            '수집 거래 기준은 아직 전표 확정 전 거래도 포함하므로 운영 판단용으로 사용합니다.'
          ]
  };
}

function buildTotals(
  accounts: FundingAccountOverviewAccountItem[]
): FundingAccountOverviewTotals {
  return {
    fundingAccountCount: accounts.length,
    activeFundingAccountCount: accounts.filter(
      (account) => account.status === 'ACTIVE'
    ).length,
    openingBalanceWon: sumMoneyWon(
      accounts.map((account) => account.openingBalanceWon)
    ),
    liveBalanceWon: sumMoneyWon(
      accounts.map((account) => account.liveBalanceWon)
    ),
    basisClosingBalanceWon: sumMoneyWon(
      accounts.map((account) => account.basisClosingBalanceWon)
    ),
    incomeWon: sumMoneyWon(accounts.map((account) => account.incomeWon)),
    expenseWon: sumMoneyWon(accounts.map((account) => account.expenseWon)),
    transferInWon: sumMoneyWon(
      accounts.map((account) => account.transferInWon)
    ),
    transferOutWon: sumMoneyWon(
      accounts.map((account) => account.transferOutWon)
    ),
    netFlowWon: sumMoneyWon(accounts.map((account) => account.netFlowWon)),
    remainingPlannedIncomeWon: sumMoneyWon(
      accounts.map((account) => account.remainingPlannedIncomeWon)
    ),
    remainingPlannedExpenseWon: sumMoneyWon(
      accounts.map((account) => account.remainingPlannedExpenseWon)
    ),
    expectedClosingBalanceWon: sumMoneyWon(
      accounts.map((account) => account.expectedClosingBalanceWon)
    ),
    transactionCount: accounts.reduce(
      (count, account) => count + account.transactionCount,
      0
    ),
    pendingTransactionCount: accounts.reduce(
      (count, account) => count + account.pendingTransactionCount,
      0
    ),
    postedTransactionCount: accounts.reduce(
      (count, account) => count + account.postedTransactionCount,
      0
    )
  };
}
