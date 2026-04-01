import type {
  AccountSubjectKind,
  AccountingPeriodStatus
} from '@prisma/client';
import type {
  ReportingHighlightItem,
  ReportingTrendPoint
} from '@personal-erp/contracts';

export type JournalLineMetricInput = {
  debitAmount: number;
  creditAmount: number;
  accountSubject: {
    subjectKind: AccountSubjectKind;
  };
};

export type PlanItemMetricInput = {
  plannedAmount: number;
  status: 'DRAFT' | 'MATCHED' | 'CONFIRMED' | 'SKIPPED' | 'EXPIRED';
  ledgerTransactionTypeId: string;
};

export type LedgerTransactionTypeMetricInput = {
  id: string;
  flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
};

export type ClosingSnapshotMetricInput = {
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  periodPnLAmount: number;
};

export function summarizeJournalLines(lines: JournalLineMetricInput[]) {
  return lines.reduce(
    (summary, line) => {
      switch (line.accountSubject.subjectKind) {
        case 'INCOME':
          summary.incomeWon += line.creditAmount - line.debitAmount;
          break;
        case 'EXPENSE':
          summary.expenseWon += line.debitAmount - line.creditAmount;
          break;
        default:
          break;
      }

      return summary;
    },
    {
      incomeWon: 0,
      expenseWon: 0
    }
  );
}

export function summarizeRemainingPlanItems(input: {
  planItems: PlanItemMetricInput[];
  ledgerTransactionTypes: LedgerTransactionTypeMetricInput[];
}) {
  const flowKindByTypeId = new Map(
    input.ledgerTransactionTypes.map((item) => [item.id, item.flowKind])
  );

  return input.planItems.reduce(
    (summary, item) => {
      if (
        item.status === 'CONFIRMED' ||
        item.status === 'SKIPPED' ||
        item.status === 'EXPIRED'
      ) {
        return summary;
      }

      const flowKind = flowKindByTypeId.get(item.ledgerTransactionTypeId);
      if (flowKind === 'INCOME') {
        summary.plannedIncomeWon += item.plannedAmount;
      } else if (flowKind === 'EXPENSE') {
        summary.plannedExpenseWon += item.plannedAmount;
      }

      return summary;
    },
    {
      plannedIncomeWon: 0,
      plannedExpenseWon: 0
    }
  );
}

export function buildTrendPoint(input: {
  periodId: string;
  monthLabel: string;
  periodStatus: AccountingPeriodStatus;
  incomeWon: number;
  expenseWon: number;
  plannedIncomeWon: number;
  plannedExpenseWon: number;
  actualBalanceWon: number | null;
  closingSnapshot: ClosingSnapshotMetricInput | null;
}): ReportingTrendPoint {
  const periodPnLWon = input.closingSnapshot
    ? input.closingSnapshot.periodPnLAmount
    : input.incomeWon - input.expenseWon;
  const cashWon = input.actualBalanceWon;
  const netWorthWon = input.closingSnapshot
    ? input.closingSnapshot.totalAssetAmount -
      input.closingSnapshot.totalLiabilityAmount
    : null;

  return {
    periodId: input.periodId,
    monthLabel: input.monthLabel,
    periodStatus: input.periodStatus,
    incomeWon: input.incomeWon,
    expenseWon: input.expenseWon,
    plannedIncomeWon: input.plannedIncomeWon,
    plannedExpenseWon: input.plannedExpenseWon,
    periodPnLWon,
    cashWon,
    netWorthWon,
    isOfficial: input.periodStatus === 'LOCKED'
  };
}

export function buildOperationalHighlights(input: {
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
  plannedExpenseWon: number;
  officialComparisonNetWorthWon: number | null;
}): ReportingHighlightItem[] {
  return [
    {
      label: '예상 기간말 잔액',
      amountWon: input.expectedMonthEndBalanceWon,
      tone: input.expectedMonthEndBalanceWon >= 0 ? 'POSITIVE' : 'NEGATIVE'
    },
    {
      label: '안전 잉여',
      amountWon: input.safetySurplusWon,
      tone: input.safetySurplusWon >= 0 ? 'POSITIVE' : 'NEGATIVE'
    },
    {
      label: '남은 계획 지출',
      amountWon: input.plannedExpenseWon,
      tone: input.plannedExpenseWon === 0 ? 'NEUTRAL' : 'NEGATIVE'
    },
    ...(input.officialComparisonNetWorthWon === null
      ? []
      : [
          {
            label: '최근 공식 순자산',
            amountWon: input.officialComparisonNetWorthWon,
            tone: 'NEUTRAL' as const
          }
        ])
  ];
}
