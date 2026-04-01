import type { DashboardSummary } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockDashboardSummary: DashboardSummary = {
  period: {
    id: 'period-demo-live',
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
  basisStatus: 'LIVE_OPERATIONS',
  actualBalanceWon: 3_180_000,
  confirmedIncomeWon: 3_200_000,
  confirmedExpenseWon: 1_465_000,
  remainingPlannedIncomeWon: 0,
  remainingPlannedExpenseWon: 540_000,
  minimumReserveWon: 400_000,
  expectedMonthEndBalanceWon: 2_640_000,
  safetySurplusWon: 2_240_000,
  warnings: [
    '이 기간은 아직 잠금 전 운영 기간이므로 공식 재무제표와는 구분해서 해석합니다.'
  ],
  highlights: [
    { label: '예상 기간말 잔액', amountWon: 2_640_000, tone: 'POSITIVE' },
    { label: '안전 잉여', amountWon: 2_240_000, tone: 'POSITIVE' },
    { label: '남은 계획 지출', amountWon: 540_000, tone: 'NEGATIVE' }
  ],
  trend: [
    {
      periodId: 'period-demo-1',
      monthLabel: '2026-01',
      periodStatus: 'LOCKED',
      incomeWon: 3_050_000,
      expenseWon: 1_420_000,
      plannedIncomeWon: 0,
      plannedExpenseWon: 0,
      periodPnLWon: 1_630_000,
      cashWon: 2_550_000,
      netWorthWon: 2_550_000,
      isOfficial: true
    },
    {
      periodId: 'period-demo-2',
      monthLabel: '2026-02',
      periodStatus: 'LOCKED',
      incomeWon: 3_180_000,
      expenseWon: 1_510_000,
      plannedIncomeWon: 0,
      plannedExpenseWon: 0,
      periodPnLWon: 1_670_000,
      cashWon: 2_830_000,
      netWorthWon: 2_830_000,
      isOfficial: true
    },
    {
      periodId: 'period-demo-live',
      monthLabel: '2026-03',
      periodStatus: 'OPEN',
      incomeWon: 3_200_000,
      expenseWon: 1_465_000,
      plannedIncomeWon: 0,
      plannedExpenseWon: 540_000,
      periodPnLWon: 1_735_000,
      cashWon: 3_180_000,
      netWorthWon: null,
      isOfficial: false
    }
  ],
  officialComparison: {
    periodId: 'period-demo-2',
    monthLabel: '2026-02',
    officialCashWon: 2_830_000,
    officialNetWorthWon: 2_830_000,
    officialPeriodPnLWon: 1_670_000
  }
};

export function getDashboardSummary(periodId?: string | null) {
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : '';
  return fetchJson<DashboardSummary | null>(
    `/dashboard/summary${query}`,
    mockDashboardSummary
  );
}
