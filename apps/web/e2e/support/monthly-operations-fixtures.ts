import type {
  AccountingPeriodItem,
  CarryForwardView,
  FinancialStatementsView,
  ForecastResponse,
  GeneratePlanItemsResponse,
  PlanItemsView,
  DashboardSummary
} from '@personal-erp/contracts';

type MonthlyOperationsPeriods = {
  previousLocked: AccountingPeriodItem;
  reportingLocked: AccountingPeriodItem;
  openBeforeCarryForward: AccountingPeriodItem;
  openAfterCarryForward: AccountingPeriodItem;
};

export function createMonthlyOperationsPeriods(): MonthlyOperationsPeriods {
  const previousLocked = buildPeriod({
    id: 'period-2026-03',
    year: 2026,
    month: 3,
    status: 'LOCKED',
    openedAt: '2026-03-01T00:00:00.000Z',
    lockedAt: '2026-03-31T15:00:00.000Z',
    openingBalanceSourceKind: 'INITIAL_SETUP',
    hasOpeningBalanceSnapshot: true
  });

  const reportingLocked = buildPeriod({
    id: 'period-2026-04',
    year: 2026,
    month: 4,
    status: 'LOCKED',
    openedAt: '2026-04-01T00:00:00.000Z',
    lockedAt: '2026-04-30T15:00:00.000Z',
    openingBalanceSourceKind: 'CARRY_FORWARD',
    hasOpeningBalanceSnapshot: true
  });

  const openBeforeCarryForward = buildPeriod({
    id: 'period-2026-05',
    year: 2026,
    month: 5,
    status: 'OPEN',
    openedAt: '2026-05-01T00:00:00.000Z',
    lockedAt: null,
    openingBalanceSourceKind: null,
    hasOpeningBalanceSnapshot: false
  });

  const openAfterCarryForward = {
    ...openBeforeCarryForward,
    hasOpeningBalanceSnapshot: true,
    openingBalanceSourceKind: 'CARRY_FORWARD' as const
  };

  return {
    previousLocked,
    reportingLocked,
    openBeforeCarryForward,
    openAfterCarryForward
  };
}

export function createEmptyPlanItemsView(
  period: AccountingPeriodItem
): PlanItemsView {
  return {
    period,
    items: [],
    summary: {
      totalCount: 0,
      totalPlannedAmount: 0,
      draftCount: 0,
      matchedCount: 0,
      confirmedCount: 0,
      skippedCount: 0,
      expiredCount: 0
    }
  };
}

export function createGeneratedPlanItemsResponse(
  period: AccountingPeriodItem
): GeneratePlanItemsResponse {
  const items: PlanItemsView['items'] = [
    {
      id: 'plan-item-rent',
      periodId: period.id,
      title: '5월 월세 자동 이체',
      plannedDate: '2026-05-05',
      plannedAmount: 1_200_000,
      status: 'DRAFT',
      recurringRuleId: 'rr-rent',
      recurringRuleTitle: '월세 자동 이체',
      ledgerTransactionTypeName: '기본 지출',
      fundingAccountName: '사업 운영 통장',
      categoryName: '원재료비',
      matchedCollectedTransactionId: null,
      matchedCollectedTransactionTitle: null,
      matchedCollectedTransactionStatus: null,
      postedJournalEntryId: null,
      postedJournalEntryNumber: null
    },
    {
      id: 'plan-item-insurance',
      periodId: period.id,
      title: '업무용 차량 보험료',
      plannedDate: '2026-05-25',
      plannedAmount: 98_000,
      status: 'MATCHED',
      recurringRuleId: 'rr-insurance',
      recurringRuleTitle: '삼성화재 업무용 차량 보험',
      ledgerTransactionTypeName: '기본 지출',
      fundingAccountName: '사업 운영 통장',
      categoryName: '보험료',
      matchedCollectedTransactionId: 'txn-matched-insurance',
      matchedCollectedTransactionTitle: '업무용 차량 보험료',
      matchedCollectedTransactionStatus: 'READY_TO_POST',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null
    }
  ];

  return {
    period,
    items,
    summary: {
      totalCount: items.length,
      totalPlannedAmount: 1_298_000,
      draftCount: 1,
      matchedCount: 1,
      confirmedCount: 0,
      skippedCount: 0,
      expiredCount: 0
    },
    generation: {
      createdCount: items.length,
      skippedExistingCount: 0,
      excludedRuleCount: 0
    }
  };
}

export function createDashboardSummary(input: {
  period: AccountingPeriodItem;
  previousLockedPeriod: AccountingPeriodItem;
  planItemsGenerated: boolean;
  carryForwardGenerated: boolean;
}): DashboardSummary {
  const remainingPlannedExpenseWon = input.planItemsGenerated ? 1_298_000 : 0;
  const warnings = input.planItemsGenerated
    ? [
        '생성된 계획 항목 2건이 현재 운영 월 전망에 반영됩니다.',
        ...readCarryForwardWarnings(input.carryForwardGenerated)
      ]
    : [
        '아직 생성된 계획 항목이 없어 남은 계획 지출이 0원 기준으로 보입니다.',
        ...readCarryForwardWarnings(input.carryForwardGenerated)
      ];

  return {
    period: input.period,
    basisStatus: 'LIVE_OPERATIONS',
    actualBalanceWon: 3_640_000,
    confirmedIncomeWon: 4_150_000,
    confirmedExpenseWon: 1_820_000,
    remainingPlannedIncomeWon: 0,
    remainingPlannedExpenseWon,
    minimumReserveWon: 400_000,
    expectedMonthEndBalanceWon: 3_640_000 - remainingPlannedExpenseWon,
    safetySurplusWon: 3_240_000 - remainingPlannedExpenseWon,
    warnings,
    highlights: [
      {
        label: '예상 기간말 잔액',
        amountWon: 3_640_000 - remainingPlannedExpenseWon,
        tone: 'POSITIVE'
      },
      {
        label: '안전 잉여',
        amountWon: 3_240_000 - remainingPlannedExpenseWon,
        tone: 'POSITIVE'
      },
      {
        label: '남은 계획 지출',
        amountWon: remainingPlannedExpenseWon,
        tone: remainingPlannedExpenseWon > 0 ? 'NEGATIVE' : 'NEUTRAL'
      }
    ],
    trend: [
      {
        periodId: input.previousLockedPeriod.id,
        monthLabel: input.previousLockedPeriod.monthLabel,
        periodStatus: input.previousLockedPeriod.status,
        incomeWon: 4_020_000,
        expenseWon: 1_780_000,
        plannedIncomeWon: 0,
        plannedExpenseWon: 0,
        periodPnLWon: 2_240_000,
        cashWon: 3_100_000,
        netWorthWon: 3_100_000,
        isOfficial: true
      },
      {
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        periodStatus: input.period.status,
        incomeWon: 4_150_000,
        expenseWon: 1_820_000,
        plannedIncomeWon: 0,
        plannedExpenseWon: remainingPlannedExpenseWon,
        periodPnLWon: 2_330_000,
        cashWon: 3_640_000,
        netWorthWon: null,
        isOfficial: false
      }
    ],
    officialComparison: {
      periodId: input.previousLockedPeriod.id,
      monthLabel: input.previousLockedPeriod.monthLabel,
      officialCashWon: 3_100_000,
      officialNetWorthWon: 3_100_000,
      officialPeriodPnLWon: 2_240_000
    }
  };
}

export function createForecastResponse(input: {
  period: AccountingPeriodItem;
  previousLockedPeriod: AccountingPeriodItem;
  planItemsGenerated: boolean;
  carryForwardGenerated: boolean;
}): ForecastResponse {
  const remainingPlannedExpenseWon = input.planItemsGenerated ? 1_298_000 : 0;
  const carryForwardNote = input.carryForwardGenerated
    ? '기초 잔액은 2026-04 차기 이월 기준입니다.'
    : '차기 이월 전 수기/초기 설정 기준으로 기초 잔액을 해석하고 있습니다.';

  return {
    period: input.period,
    basisStatus: 'LIVE_OPERATIONS',
    actualBalanceWon: 3_640_000,
    confirmedIncomeWon: 4_150_000,
    expectedIncomeWon: 0,
    confirmedExpenseWon: 1_820_000,
    remainingPlannedExpenseWon,
    sinkingFundWon: 180_000,
    minimumReserveWon: 400_000,
    expectedMonthEndBalanceWon: 3_460_000 - remainingPlannedExpenseWon,
    safetySurplusWon: 3_060_000 - remainingPlannedExpenseWon,
    warnings: ['이 기간은 아직 잠금 전 운영 기간이라 전망 수치입니다.'],
    highlights: [
      {
        label: '예상 기간말 잔액',
        amountWon: 3_460_000 - remainingPlannedExpenseWon,
        tone: 'POSITIVE'
      },
      {
        label: '안전 잉여',
        amountWon: 3_060_000 - remainingPlannedExpenseWon,
        tone: 'POSITIVE'
      },
      {
        label: '남은 계획 지출',
        amountWon: remainingPlannedExpenseWon,
        tone: remainingPlannedExpenseWon > 0 ? 'NEGATIVE' : 'NEUTRAL'
      }
    ],
    trend: [
      {
        periodId: input.previousLockedPeriod.id,
        monthLabel: input.previousLockedPeriod.monthLabel,
        periodStatus: input.previousLockedPeriod.status,
        incomeWon: 4_020_000,
        expenseWon: 1_780_000,
        plannedIncomeWon: 0,
        plannedExpenseWon: 0,
        periodPnLWon: 2_240_000,
        cashWon: 3_100_000,
        netWorthWon: 3_100_000,
        isOfficial: true
      },
      {
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        periodStatus: input.period.status,
        incomeWon: 4_150_000,
        expenseWon: 1_820_000,
        plannedIncomeWon: 0,
        plannedExpenseWon: remainingPlannedExpenseWon,
        periodPnLWon: 2_330_000,
        cashWon: 3_640_000,
        netWorthWon: null,
        isOfficial: false
      }
    ],
    officialComparison: {
      periodId: input.previousLockedPeriod.id,
      monthLabel: input.previousLockedPeriod.monthLabel,
      officialCashWon: 3_100_000,
      officialNetWorthWon: 3_100_000,
      officialPeriodPnLWon: 2_240_000
    },
    notes: [
      input.planItemsGenerated
        ? '현재 선택한 기간에는 계획 항목 2건이 남은 계획 지출에 반영되어 있습니다.'
        : '아직 생성된 계획 항목이 없어 남은 계획 지출이 비어 있습니다.',
      carryForwardNote
    ],
    categoryDrivers: [],
    periodComparison: null,
    nextMonthProjection: null
  };
}

export function createFinancialStatementsView(input: {
  period: AccountingPeriodItem;
  previousPeriod: AccountingPeriodItem;
}): FinancialStatementsView {
  return {
    period: input.period,
    previousPeriod: input.previousPeriod,
    basis: {
      openingBalanceSourceKind: 'CARRY_FORWARD',
      carryForwardRecordId: 'carry-forward-2026-03-to-2026-04',
      sourceClosingSnapshotId: 'closing-2026-03',
      sourcePeriodId: input.previousPeriod.id,
      sourceMonthLabel: input.previousPeriod.monthLabel
    },
    snapshots: [
      {
        id: 'statement-sfp-2026-04',
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        statementKind: 'STATEMENT_OF_FINANCIAL_POSITION',
        currency: 'KRW',
        createdAt: '2026-04-30T15:10:00.000Z',
        payload: {
          summary: [
            { label: '자산 합계', amountWon: 5_640_000 },
            { label: '부채 합계', amountWon: 1_120_000 },
            { label: '순자산', amountWon: 4_520_000 }
          ],
          sections: [
            {
              title: '유동자산',
              items: [
                { label: '현금및예금', amountWon: 3_980_000 },
                { label: '매출채권', amountWon: 1_660_000 }
              ]
            }
          ],
          notes: ['차기 이월 기준과 잠금된 전표를 기준으로 생성했습니다.']
        }
      },
      {
        id: 'statement-pnl-2026-04',
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        statementKind: 'MONTHLY_PROFIT_AND_LOSS',
        currency: 'KRW',
        createdAt: '2026-04-30T15:10:00.000Z',
        payload: {
          summary: [
            { label: '매출 합계', amountWon: 4_020_000 },
            { label: '비용 합계', amountWon: 1_780_000 },
            { label: '당기 손익', amountWon: 2_240_000 }
          ],
          sections: [
            {
              title: '영업비용',
              items: [
                { label: '원재료비', amountWon: 1_200_000 },
                { label: '보험료', amountWon: 98_000 }
              ]
            }
          ],
          notes: []
        }
      },
      {
        id: 'statement-cashflow-2026-04',
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        statementKind: 'CASH_FLOW_SUMMARY',
        currency: 'KRW',
        createdAt: '2026-04-30T15:10:00.000Z',
        payload: {
          summary: [
            { label: '영업활동 현금흐름', amountWon: 1_980_000 },
            { label: '투자활동 현금흐름', amountWon: -220_000 },
            { label: '재무활동 현금흐름', amountWon: 0 }
          ],
          sections: [],
          notes: []
        }
      },
      {
        id: 'statement-net-worth-2026-04',
        periodId: input.period.id,
        monthLabel: input.period.monthLabel,
        statementKind: 'NET_WORTH_MOVEMENT',
        currency: 'KRW',
        createdAt: '2026-04-30T15:10:00.000Z',
        payload: {
          summary: [
            { label: '기초 순자산', amountWon: 2_280_000 },
            { label: '당기 순증감', amountWon: 2_240_000 },
            { label: '기말 순자산', amountWon: 4_520_000 }
          ],
          sections: [],
          notes: []
        }
      }
    ],
    comparison: [
      {
        statementKind: 'STATEMENT_OF_FINANCIAL_POSITION',
        metrics: [
          {
            label: '순자산',
            currentAmountWon: 4_520_000,
            previousAmountWon: 3_100_000,
            deltaWon: 1_420_000,
            deltaRate: 45.8
          }
        ]
      },
      {
        statementKind: 'MONTHLY_PROFIT_AND_LOSS',
        metrics: [
          {
            label: '당기 손익',
            currentAmountWon: 2_240_000,
            previousAmountWon: 2_020_000,
            deltaWon: 220_000,
            deltaRate: 10.9
          }
        ]
      }
    ],
    warnings: ['이 스냅샷은 잠금 완료된 월만 대상으로 합니다.']
  };
}

export function createCarryForwardView(input: {
  sourcePeriod: AccountingPeriodItem;
  targetPeriod: AccountingPeriodItem;
}): CarryForwardView {
  return {
    carryForwardRecord: {
      id: 'carry-forward-2026-04-to-2026-05',
      fromPeriodId: input.sourcePeriod.id,
      toPeriodId: input.targetPeriod.id,
      sourceClosingSnapshotId: 'closing-2026-04',
      createdJournalEntryId: 'je-carry-forward-2026-05',
      createdAt: '2026-04-30T15:20:00.000Z',
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: 'membership-demo'
    },
    sourcePeriod: input.sourcePeriod,
    sourceClosingSnapshot: {
      id: 'closing-2026-04',
      periodId: input.sourcePeriod.id,
      lockedAt: '2026-04-30T15:00:00.000Z',
      totalAssetAmount: 5_640_000,
      totalLiabilityAmount: 1_120_000,
      totalEquityAmount: 4_520_000,
      periodPnLAmount: 2_240_000,
      lines: [
        {
          id: 'closing-line-cash',
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '사업 운영 통장',
          balanceAmount: 3_980_000
        }
      ]
    },
    targetPeriod: input.targetPeriod,
    targetOpeningBalanceSnapshot: {
      id: 'opening-2026-05',
      effectivePeriodId: input.targetPeriod.id,
      sourceKind: 'CARRY_FORWARD',
      createdAt: '2026-04-30T15:20:00.000Z',
      lines: [
        {
          id: 'opening-line-cash',
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '사업 운영 통장',
          balanceAmount: 3_980_000
        },
        {
          id: 'opening-line-payable',
          accountSubjectCode: '2100',
          accountSubjectName: '미지급금',
          fundingAccountName: null,
          balanceAmount: 1_120_000
        }
      ]
    }
  };
}

function buildPeriod(input: {
  id: string;
  year: number;
  month: number;
  status: AccountingPeriodItem['status'];
  openedAt: string;
  lockedAt: string | null;
  openingBalanceSourceKind: AccountingPeriodItem['openingBalanceSourceKind'];
  hasOpeningBalanceSnapshot: boolean;
}): AccountingPeriodItem {
  const monthLabel = `${input.year}-${String(input.month).padStart(2, '0')}`;
  const nextYear = input.month === 12 ? input.year + 1 : input.year;
  const nextMonth = input.month === 12 ? 1 : input.month + 1;

  return {
    id: input.id,
    year: input.year,
    month: input.month,
    monthLabel,
    startDate: `${monthLabel}-01T00:00:00.000Z`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`,
    status: input.status,
    openedAt: input.openedAt,
    lockedAt: input.lockedAt,
    hasOpeningBalanceSnapshot: input.hasOpeningBalanceSnapshot,
    openingBalanceSourceKind: input.openingBalanceSourceKind,
    statusHistory: [
      {
        id: `${input.id}-opened`,
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright monthly loop scenario setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: input.openedAt
      },
      ...(input.lockedAt
        ? [
            {
              id: `${input.id}-locked`,
              fromStatus: 'OPEN' as const,
              toStatus: 'LOCKED' as const,
              eventType: 'LOCK' as const,
              reason: 'Playwright monthly loop scenario lock',
              actorType: 'TENANT_MEMBERSHIP' as const,
              actorMembershipId: 'membership-demo',
              changedAt: input.lockedAt
            }
          ]
        : [])
    ]
  };
}

function readCarryForwardWarnings(carryForwardGenerated: boolean) {
  return carryForwardGenerated
    ? ['현재 운영 월은 2026-04 차기 이월 기준으로 시작합니다.']
    : [
        '차기 이월 전이라 현재 운영 월의 기초 잔액 출처를 함께 점검해야 합니다.'
      ];
}
