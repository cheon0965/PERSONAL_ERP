import type {
  ForecastCategoryDriver,
  ForecastFixedCostItem,
  ForecastNextMonthProjection,
  ForecastPeriodComparison,
  ForecastResponse
} from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/public';
import {
  buildOperationalHighlights,
  buildTrendPoint,
  summarizeJournalLines,
  summarizeRemainingPlanItems
} from '../reporting/reporting-metrics';
import type { MonthlyForecastReadModel } from './forecast-read.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400_000;
const DEFAULT_MONTHLY_SINKING_FUND_WON = 140_000;
const MAX_CATEGORY_DRIVERS = 5;

export function projectMonthlyForecast(
  readModel: MonthlyForecastReadModel
): ForecastResponse {
  const minimumReserveWon =
    readModel.minimumReserveWon ?? DEFAULT_MINIMUM_RESERVE_WON;
  const sinkingFundWon =
    readModel.monthlySinkingFundWon ?? DEFAULT_MONTHLY_SINKING_FUND_WON;
  const confirmed = summarizeJournalLines(readModel.targetJournalLines);
  const remainingPlan = summarizeRemainingPlanItems({
    planItems: readModel.targetPlanItems,
    ledgerTransactionTypes: readModel.ledgerTransactionTypes
  });
  const actualBalanceWon =
    readModel.basisStatus === 'OFFICIAL_LOCKED'
      ? (readModel.targetClosingSnapshot?.cashBalanceWon ??
        readModel.currentFundingBalanceWon)
      : readModel.currentFundingBalanceWon;
  const expectedIncomeWon = remainingPlan.plannedIncomeWon;
  const expectedMonthEndBalanceWon = subtractMoneyWon(
    subtractMoneyWon(
      addMoneyWon(actualBalanceWon, expectedIncomeWon),
      remainingPlan.plannedExpenseWon
    ),
    sinkingFundWon
  );
  const safetySurplusWon = subtractMoneyWon(
    expectedMonthEndBalanceWon,
    minimumReserveWon
  );
  const comparisonPeriod = readModel.comparisonPeriod;
  const comparisonMonthLabel = comparisonPeriod
    ? `${comparisonPeriod.year}-${String(comparisonPeriod.month).padStart(2, '0')}`
    : null;

  return {
    period: mapAccountingPeriodRecordToItem(readModel.targetPeriod),
    basisStatus: readModel.basisStatus,
    actualBalanceWon,
    confirmedIncomeWon: confirmed.incomeWon,
    expectedIncomeWon,
    confirmedExpenseWon: confirmed.expenseWon,
    remainingPlannedExpenseWon: remainingPlan.plannedExpenseWon,
    sinkingFundWon,
    minimumReserveWon,
    expectedMonthEndBalanceWon,
    safetySurplusWon,
    warnings: buildWarnings(readModel),
    highlights: buildOperationalHighlights({
      expectedMonthEndBalanceWon,
      safetySurplusWon,
      plannedExpenseWon: remainingPlan.plannedExpenseWon,
      officialComparisonNetWorthWon: readModel.comparisonClosingSnapshot
        ? subtractMoneyWon(
            readModel.comparisonClosingSnapshot.totalAssetAmount,
            readModel.comparisonClosingSnapshot.totalLiabilityAmount
          )
        : null
    }),
    trend: readModel.trend.map((item) => {
      const metrics = summarizeJournalLines(item.journalLines);
      const plans = summarizeRemainingPlanItems({
        planItems: item.planItems,
        ledgerTransactionTypes: readModel.ledgerTransactionTypes
      });

      return buildTrendPoint({
        periodId: item.period.id,
        monthLabel: `${item.period.year}-${String(item.period.month).padStart(2, '0')}`,
        periodStatus: item.period.status,
        incomeWon: metrics.incomeWon,
        expenseWon: metrics.expenseWon,
        plannedIncomeWon: plans.plannedIncomeWon,
        plannedExpenseWon: plans.plannedExpenseWon,
        actualBalanceWon:
          item.period.id === readModel.targetPeriod.id
            ? actualBalanceWon
            : (item.closingSnapshot?.cashBalanceWon ?? null),
        closingSnapshot: item.closingSnapshot
      });
    }),
    officialComparison:
      comparisonPeriod && readModel.comparisonClosingSnapshot
        ? {
            periodId: comparisonPeriod.id,
            monthLabel: comparisonMonthLabel ?? comparisonPeriod.id,
            officialCashWon: readModel.comparisonClosingSnapshot.cashBalanceWon,
            officialNetWorthWon: subtractMoneyWon(
              readModel.comparisonClosingSnapshot.totalAssetAmount,
              readModel.comparisonClosingSnapshot.totalLiabilityAmount
            ),
            officialPeriodPnLWon:
              readModel.comparisonClosingSnapshot.periodPnLAmount
          }
        : null,
    notes: buildNotes(readModel),
    categoryDrivers: buildCategoryDrivers(readModel),
    periodComparison: buildPeriodComparison(readModel, confirmed),
    nextMonthProjection: buildNextMonthProjection(
      readModel,
      expectedMonthEndBalanceWon
    )
  };
}

function buildWarnings(readModel: MonthlyForecastReadModel) {
  const warnings: string[] = [];
  const monthLabel = `${readModel.targetPeriod.year}-${String(readModel.targetPeriod.month).padStart(2, '0')}`;

  if (readModel.basisStatus === 'LIVE_OPERATIONS') {
    warnings.push(
      `${monthLabel}은(는) 잠금 전 운영 기간이라 전망 수치와 공식 마감 수치를 구분해 봐야 합니다.`
    );
  }

  if (!readModel.comparisonPeriod || !readModel.comparisonClosingSnapshot) {
    warnings.push(
      '비교할 공식 잠금 기간이 없어 전망과 공식 수치의 차이를 아직 나란히 보여줄 수 없습니다.'
    );
  }

  return warnings;
}

function buildNotes(readModel: MonthlyForecastReadModel) {
  if (readModel.basisStatus === 'OFFICIAL_LOCKED') {
    return [
      '선택한 기간이 이미 잠금되어 있어 전망 대신 공식 마감 수치를 함께 보여줍니다.',
      '향후 운영 판단은 다음 열린 기간을 기준으로 다시 계산하는 편이 좋습니다.'
    ];
  }

  return [
    '전망 수치는 확정 전표와 아직 남은 계획 항목을 함께 읽어 운영 의사결정을 돕습니다.',
    '잠금 전 화면이므로 공식 재무제표와는 반드시 구분해서 해석합니다.'
  ];
}

function buildCategoryDrivers(
  readModel: MonthlyForecastReadModel
): ForecastCategoryDriver[] {
  const categoryMap = new Map<
    string,
    {
      confirmedWon: number;
      remainingPlannedWon: number;
      flowKind: 'INCOME' | 'EXPENSE';
    }
  >();

  for (const line of readModel.targetCategoryJournalLines) {
    const kind = line.accountSubject.subjectKind;
    if (kind !== 'INCOME' && kind !== 'EXPENSE') continue;

    const name = line.categoryName ?? '미분류';
    const flowKind = kind === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const key = `${flowKind}:${name}`;
    const existing = categoryMap.get(key) ?? {
      confirmedWon: 0,
      remainingPlannedWon: 0,
      flowKind
    };

    if (kind === 'INCOME') {
      existing.confirmedWon = addMoneyWon(
        existing.confirmedWon,
        subtractMoneyWon(line.creditAmount, line.debitAmount)
      );
    } else {
      existing.confirmedWon = addMoneyWon(
        existing.confirmedWon,
        subtractMoneyWon(line.debitAmount, line.creditAmount)
      );
    }

    categoryMap.set(key, existing);
  }

  const flowKindByTypeId = new Map(
    readModel.ledgerTransactionTypes.map((t) => [t.id, t.flowKind])
  );

  for (const item of readModel.targetCategoryPlanItems) {
    if (
      item.status === 'CONFIRMED' ||
      item.status === 'SKIPPED' ||
      item.status === 'EXPIRED'
    )
      continue;

    const flowKind = flowKindByTypeId.get(item.ledgerTransactionTypeId);
    if (flowKind !== 'INCOME' && flowKind !== 'EXPENSE') continue;

    const name = item.categoryName ?? '미분류';
    const key = `${flowKind}:${name}`;
    const existing = categoryMap.get(key) ?? {
      confirmedWon: 0,
      remainingPlannedWon: 0,
      flowKind
    };

    existing.remainingPlannedWon = addMoneyWon(
      existing.remainingPlannedWon,
      item.plannedAmount
    );
    categoryMap.set(key, existing);
  }

  const drivers = Array.from(categoryMap.entries())
    .map(([key, value]) => ({
      categoryName: key.split(':').slice(1).join(':'),
      ...value
    }))
    .sort(
      (a, b) =>
        addMoneyWon(b.confirmedWon, b.remainingPlannedWon) -
        addMoneyWon(a.confirmedWon, a.remainingPlannedWon)
    );

  if (drivers.length <= MAX_CATEGORY_DRIVERS) {
    return drivers;
  }

  const top = drivers.slice(0, MAX_CATEGORY_DRIVERS);
  const rest = drivers.slice(MAX_CATEGORY_DRIVERS);

  const others: ForecastCategoryDriver[] = [];

  const incomeRest = rest.filter((d) => d.flowKind === 'INCOME');
  if (incomeRest.length > 0) {
    others.push({
      categoryName: '기타',
      confirmedWon: incomeRest.reduce(
        (s, d) => addMoneyWon(s, d.confirmedWon),
        0
      ),
      remainingPlannedWon: incomeRest.reduce(
        (s, d) => addMoneyWon(s, d.remainingPlannedWon),
        0
      ),
      flowKind: 'INCOME'
    });
  }

  const expenseRest = rest.filter((d) => d.flowKind === 'EXPENSE');
  if (expenseRest.length > 0) {
    others.push({
      categoryName: '기타',
      confirmedWon: expenseRest.reduce(
        (s, d) => addMoneyWon(s, d.confirmedWon),
        0
      ),
      remainingPlannedWon: expenseRest.reduce(
        (s, d) => addMoneyWon(s, d.remainingPlannedWon),
        0
      ),
      flowKind: 'EXPENSE'
    });
  }

  return [...top, ...others];
}

function buildPeriodComparison(
  readModel: MonthlyForecastReadModel,
  currentConfirmed: { incomeWon: number; expenseWon: number }
): ForecastPeriodComparison | null {
  if (!readModel.previousPeriodMetrics) return null;

  const prev = readModel.previousPeriodMetrics;
  const prevYear =
    readModel.targetPeriod.month === 1
      ? readModel.targetPeriod.year - 1
      : readModel.targetPeriod.year;
  const prevMonth =
    readModel.targetPeriod.month === 1
      ? 12
      : readModel.targetPeriod.month - 1;

  const incomeChange = subtractMoneyWon(
    currentConfirmed.incomeWon,
    prev.incomeWon
  );
  const expenseChange = subtractMoneyWon(
    currentConfirmed.expenseWon,
    prev.expenseWon
  );
  const balanceChange =
    prev.balanceWon != null
      ? subtractMoneyWon(readModel.currentFundingBalanceWon, prev.balanceWon)
      : 0;

  return {
    previousMonthLabel: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
    incomeChangeWon: incomeChange,
    expenseChangeWon: expenseChange,
    balanceChangeWon: balanceChange,
    incomeChangePercent:
      prev.incomeWon !== 0
        ? Math.round((incomeChange / prev.incomeWon) * 1000) / 10
        : null,
    expenseChangePercent:
      prev.expenseWon !== 0
        ? Math.round((expenseChange / prev.expenseWon) * 1000) / 10
        : null
  };
}

function buildNextMonthProjection(
  readModel: MonthlyForecastReadModel,
  currentExpectedMonthEndBalanceWon: number
): ForecastNextMonthProjection | null {
  const nextYear =
    readModel.targetPeriod.month === 12
      ? readModel.targetPeriod.year + 1
      : readModel.targetPeriod.year;
  const nextMonth =
    readModel.targetPeriod.month === 12
      ? 1
      : readModel.targetPeriod.month + 1;
  const monthLabel = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

  const isOpen = readModel.nextPeriod != null;
  const hasPlanItems = readModel.nextPeriodPlanItems.length > 0;

  const fixedCosts: ForecastFixedCostItem[] = [];
  let estimatedIncomeWon = 0;
  let estimatedExpenseWon = 0;

  if (hasPlanItems) {
    const nextPlanSummary = summarizeRemainingPlanItems({
      planItems: readModel.nextPeriodPlanItems,
      ledgerTransactionTypes: readModel.ledgerTransactionTypes
    });
    estimatedIncomeWon = nextPlanSummary.plannedIncomeWon;
    estimatedExpenseWon = nextPlanSummary.plannedExpenseWon;
  } else {
    for (const rule of readModel.activeRecurringRules) {
      if (rule.flowKind === 'INCOME') {
        estimatedIncomeWon = addMoneyWon(estimatedIncomeWon, rule.amountWon);
        fixedCosts.push({
          label: rule.title,
          amountWon: rule.amountWon,
          source: 'RECURRING_RULE'
        });
      } else if (rule.flowKind === 'EXPENSE') {
        estimatedExpenseWon = addMoneyWon(estimatedExpenseWon, rule.amountWon);
        fixedCosts.push({
          label: rule.title,
          amountWon: rule.amountWon,
          source: 'RECURRING_RULE'
        });
      }
    }

    for (const policy of readModel.activeInsurancePolicies) {
      estimatedExpenseWon = addMoneyWon(
        estimatedExpenseWon,
        policy.monthlyPremiumWon
      );
      fixedCosts.push({
        label: `${policy.provider} ${policy.productName}`,
        amountWon: policy.monthlyPremiumWon,
        source: 'INSURANCE'
      });
    }

    for (const repayment of readModel.nextMonthDebtRepayments) {
      estimatedExpenseWon = addMoneyWon(
        estimatedExpenseWon,
        repayment.totalAmount
      );
      fixedCosts.push({
        label: `${repayment.lenderName} 상환`,
        amountWon: repayment.totalAmount,
        source: 'LIABILITY'
      });
    }
  }

  const projectedBalanceWon = subtractMoneyWon(
    addMoneyWon(currentExpectedMonthEndBalanceWon, estimatedIncomeWon),
    estimatedExpenseWon
  );

  const basisParts: string[] = [];
  if (hasPlanItems) {
    basisParts.push(`계획 항목 ${readModel.nextPeriodPlanItems.length}건`);
  } else {
    if (readModel.activeRecurringRules.length > 0) {
      basisParts.push(
        `반복 규칙 ${readModel.activeRecurringRules.length}건`
      );
    }
    if (readModel.activeInsurancePolicies.length > 0) {
      basisParts.push(
        `보험 ${readModel.activeInsurancePolicies.length}건`
      );
    }
    if (readModel.nextMonthDebtRepayments.length > 0) {
      basisParts.push(
        `부채 상환 ${readModel.nextMonthDebtRepayments.length}건`
      );
    }
  }

  if (basisParts.length === 0 && !isOpen) {
    return null;
  }

  const basisDescription =
    basisParts.length > 0
      ? `${basisParts.join(', ')} 기반 예상입니다.`
      : '등록된 반복 규칙, 보험, 부채 상환 예정이 없어 예상값이 비어 있습니다.';

  return {
    monthLabel,
    isOpen,
    hasPlanItems,
    estimatedIncomeWon,
    estimatedExpenseWon,
    estimatedFixedCosts: fixedCosts,
    projectedBalanceWon,
    basisDescription
  };
}
