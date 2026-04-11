import type { DashboardSummary } from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import {
  buildOperationalHighlights,
  buildTrendPoint,
  summarizeJournalLines,
  summarizeRemainingPlanItems
} from '../reporting/reporting-metrics';
import type { DashboardSummaryReadModel } from './dashboard-read.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400_000;

export function projectDashboardSummary(
  readModel: DashboardSummaryReadModel
): DashboardSummary {
  const minimumReserveWon =
    readModel.minimumReserveWon ?? DEFAULT_MINIMUM_RESERVE_WON;
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
  const expectedMonthEndBalanceWon = subtractMoneyWon(
    addMoneyWon(actualBalanceWon, remainingPlan.plannedIncomeWon),
    remainingPlan.plannedExpenseWon
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
    confirmedExpenseWon: confirmed.expenseWon,
    remainingPlannedIncomeWon: remainingPlan.plannedIncomeWon,
    remainingPlannedExpenseWon: remainingPlan.plannedExpenseWon,
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
        : null
  };
}

function buildWarnings(readModel: DashboardSummaryReadModel) {
  const warnings: string[] = [];
  const monthLabel = `${readModel.targetPeriod.year}-${String(readModel.targetPeriod.month).padStart(2, '0')}`;

  if (readModel.basisStatus === 'LIVE_OPERATIONS') {
    warnings.push(
      `${monthLabel}은(는) 아직 잠금 전 운영 기간이라 공식 재무제표와는 구분해서 해석합니다.`
    );
  }

  if (!readModel.comparisonPeriod || !readModel.comparisonClosingSnapshot) {
    warnings.push(
      '비교할 이전 잠금 기간이 없어 공식 비교 수치는 아직 비어 있습니다.'
    );
  }

  if (readModel.targetPlanItems.length === 0) {
    warnings.push(
      '현재 기간에 남아 있는 계획 항목이 없어 운영 전망은 확정 전표 중심으로 계산합니다.'
    );
  }

  return warnings;
}
