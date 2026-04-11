import type { ForecastResponse } from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import {
  buildOperationalHighlights,
  buildTrendPoint,
  summarizeJournalLines,
  summarizeRemainingPlanItems
} from '../reporting/reporting-metrics';
import type { MonthlyForecastReadModel } from './forecast-read.repository';

const DEFAULT_MINIMUM_RESERVE_WON = 400_000;
const DEFAULT_MONTHLY_SINKING_FUND_WON = 140_000;

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
    notes: buildNotes(readModel)
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
