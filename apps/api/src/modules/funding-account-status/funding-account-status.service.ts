import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  FundingAccountOverviewAccountItem,
  FundingAccountOverviewBasis,
  FundingAccountOverviewCategoryItem,
  FundingAccountOverviewResponse,
  FundingAccountOverviewTotals,
  FundingAccountOverviewTransactionItem,
  FundingAccountOverviewTrendPoint
} from '@personal-erp/contracts';
import {
  addMoneyWon,
  subtractMoneyWon,
  sumMoneyWon
} from '@personal-erp/money';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  Prisma,
  type AccountSubjectKind,
  type LedgerTransactionFlowKind
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/public';
import { readWorkspaceFundingAccountLiveBalances } from '../funding-accounts/funding-account-live-balance.reader';
import { selectOperationalPeriod } from '../reporting/reporting-period-selection';

const periodInclude = Prisma.validator<Prisma.AccountingPeriodInclude>()({
  openingBalanceSnapshot: {
    select: {
      sourceKind: true
    }
  },
  statusHistory: {
    orderBy: {
      changedAt: 'desc'
    },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      eventType: true,
      reason: true,
      actorType: true,
      actorMembershipId: true,
      changedAt: true
    }
  }
});

type PeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof periodInclude;
}>;

type LiveFundingAccountRecord = {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'CARD';
  balanceWon: number;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
};

type BalanceSnapshotLineRecord = {
  fundingAccountId: string | null;
  balanceAmount: PrismaMoneyLike;
};

type CollectedTransactionRecord = {
  id: string;
  periodId: string | null;
  occurredOn: Date;
  title: string;
  amount: PrismaMoneyLike;
  status: CollectedTransactionStatus;
  fundingAccountId: string;
  fundingAccount: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  ledgerTransactionType: {
    flowKind: LedgerTransactionFlowKind;
  };
  postedJournalEntry: {
    id: string;
    entryNumber: string;
  } | null;
};

type JournalEntryRecord = {
  id: string;
  periodId: string;
  entryNumber: string;
  entryDate: Date;
  sourceKind:
    | 'COLLECTED_TRANSACTION'
    | 'PLAN_SETTLEMENT'
    | 'OPENING_BALANCE'
    | 'CARRY_FORWARD'
    | 'MANUAL_ADJUSTMENT';
  sourceCollectedTransactionId: string | null;
  status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
  memo: string | null;
  lines: Array<{
    id: string;
    accountSubjectId: string;
    fundingAccountId: string | null;
    debitAmount: PrismaMoneyLike;
    creditAmount: PrismaMoneyLike;
    description: string | null;
  }>;
};

type PlanItemRecord = {
  plannedAmount: PrismaMoneyLike;
  status: 'DRAFT' | 'MATCHED' | 'CONFIRMED' | 'SKIPPED' | 'EXPIRED';
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
};

type AccountMetrics = {
  openingBalanceWon: number;
  liveBalanceWon: number;
  basisClosingBalanceWon: number;
  incomeWon: number;
  expenseWon: number;
  transferInWon: number;
  transferOutWon: number;
  remainingPlannedIncomeWon: number;
  remainingPlannedExpenseWon: number;
  transactionCount: number;
  pendingTransactionCount: number;
  postedTransactionCount: number;
  lastActivityOn: Date | null;
};

type ClassifiedFundingFlow = {
  flowKind: Extract<
    LedgerTransactionFlowKind,
    'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT'
  >;
  amountWon: number;
};

@Injectable()
export class FundingAccountStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    user: AuthenticatedUser,
    input?: {
      basis?: string;
      periodId?: string;
      fundingAccountId?: string;
    }
  ): Promise<FundingAccountOverviewResponse | null> {
    const workspace = requireCurrentWorkspace(user);
    const basis = normalizeBasis(input?.basis);

    const [periods, liveFundingAccounts, ledgerTransactionTypes] =
      await Promise.all([
        this.prisma.accountingPeriod.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          include: periodInclude,
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }),
        readWorkspaceFundingAccountLiveBalances(
          this.prisma,
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          {
            includeInactive: true
          }
        ),
        this.prisma.ledgerTransactionType.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            isActive: true
          }
        })
      ]);

    const targetPeriod = selectOperationalPeriod(
      periods,
      input?.periodId
    ) as PeriodRecord | null;

    if (!targetPeriod) {
      return null;
    }

    const accounts = liveFundingAccounts as LiveFundingAccountRecord[];
    const accountById = new Map(
      accounts.map((account) => [account.id, account])
    );
    const selectedFundingAccountId =
      input?.fundingAccountId && accountById.has(input.fundingAccountId)
        ? input.fundingAccountId
        : null;
    const ledgerTransactionTypeById = new Map(
      ledgerTransactionTypes.map((item) => [item.id, item])
    );

    const [
      accountSubjects,
      targetCollectedTransactions,
      targetJournalEntries,
      targetPlanItems,
      openingBalanceByAccountId,
      closingBalanceByAccountId
    ] = await Promise.all([
      this.prisma.accountSubject.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          id: true,
          subjectKind: true
        }
      }),
      this.readCollectedTransactions(workspace, targetPeriod.id),
      this.readJournalEntries(workspace, targetPeriod.id),
      this.prisma.planItem.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: targetPeriod.id
        }
      }) as Promise<PlanItemRecord[]>,
      this.readOpeningBalanceByAccountId(targetPeriod.id),
      this.readClosingBalanceByAccountId(targetPeriod.id)
    ]);

    const subjectKindById = new Map(
      accountSubjects.map((subject) => [subject.id, subject.subjectKind])
    );
    const metricsByAccountId = buildInitialMetricsByAccountId(
      accounts,
      openingBalanceByAccountId
    );

    if (basis === 'COLLECTED_TRANSACTIONS') {
      for (const transaction of targetCollectedTransactions) {
        applyCollectedTransactionMetrics(metricsByAccountId, transaction);
      }
    } else {
      applyCollectedTransactionCounters(
        metricsByAccountId,
        targetCollectedTransactions
      );
      for (const journalEntry of targetJournalEntries) {
        applyJournalEntryMetrics(
          metricsByAccountId,
          journalEntry,
          subjectKindById
        );
      }
    }

    applyRemainingPlanMetrics(
      metricsByAccountId,
      targetPlanItems,
      ledgerTransactionTypeById
    );
    finalizeAccountClosingBalances({
      basis,
      targetPeriod,
      metricsByAccountId,
      closingBalanceByAccountId
    });

    const accountItems = accounts.map((account) =>
      buildAccountItem(account, metricsByAccountId.get(account.id))
    );
    const scopedAccountItems = selectedFundingAccountId
      ? accountItems.filter(
          (account) => account.id === selectedFundingAccountId
        )
      : accountItems;
    const totals = buildTotals(scopedAccountItems);
    const trend = await this.buildTrend({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      periods: periods.slice(0, 4) as PeriodRecord[],
      basis,
      selectedFundingAccountId,
      subjectKindById
    });
    const transactions = buildTransactionRows({
      basis,
      selectedFundingAccountId,
      accountById,
      collectedTransactions: targetCollectedTransactions,
      journalEntries: targetJournalEntries,
      subjectKindById
    });
    const categoryBreakdown = buildCategoryBreakdown({
      basis,
      selectedFundingAccountId,
      transactions: targetCollectedTransactions
    });

    return {
      period: mapAccountingPeriodRecordToItem(targetPeriod),
      basis,
      selectedFundingAccountId,
      totals,
      accounts: accountItems,
      trend,
      categoryBreakdown,
      transactions,
      warnings: buildWarnings({
        basis,
        period: targetPeriod,
        hasOpeningBalanceSnapshot: openingBalanceByAccountId.size > 0,
        pendingTransactionCount: totals.pendingTransactionCount,
        selectedFundingAccountId,
        selectedFundingAccountName: selectedFundingAccountId
          ? (accountById.get(selectedFundingAccountId)?.name ?? null)
          : null
      })
    };
  }

  private readCollectedTransactions(
    workspace: { tenantId: string; ledgerId: string },
    periodId: string
  ): Promise<CollectedTransactionRecord[]> {
    return this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId
      },
      select: {
        id: true,
        periodId: true,
        occurredOn: true,
        title: true,
        amount: true,
        status: true,
        fundingAccountId: true,
        fundingAccount: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        },
        ledgerTransactionType: {
          select: {
            flowKind: true
          }
        },
        postedJournalEntry: {
          select: {
            id: true,
            entryNumber: true
          }
        }
      },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }]
    }) as Promise<CollectedTransactionRecord[]>;
  }

  private readJournalEntries(
    workspace: { tenantId: string; ledgerId: string },
    periodId: string
  ): Promise<JournalEntryRecord[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId
      },
      include: {
        lines: true
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }]
    }) as Promise<JournalEntryRecord[]>;
  }

  private async readOpeningBalanceByAccountId(periodId: string) {
    const snapshot = await this.prisma.openingBalanceSnapshot.findUnique({
      where: {
        effectivePeriodId: periodId
      }
    });

    if (!snapshot) {
      return new Map<string, number>();
    }

    const lines = (await this.prisma.balanceSnapshotLine.findMany({
      where: {
        openingSnapshotId: snapshot.id
      }
    })) as BalanceSnapshotLineRecord[];

    return groupSnapshotLinesByAccountId(lines);
  }

  private async readClosingBalanceByAccountId(periodId: string) {
    const snapshot = await this.prisma.closingSnapshot.findUnique({
      where: {
        periodId
      }
    });

    if (!snapshot) {
      return new Map<string, number>();
    }

    const lines = (await this.prisma.balanceSnapshotLine.findMany({
      where: {
        closingSnapshotId: snapshot.id
      }
    })) as BalanceSnapshotLineRecord[];

    return groupSnapshotLinesByAccountId(lines);
  }

  private async buildTrend(input: {
    tenantId: string;
    ledgerId: string;
    periods: PeriodRecord[];
    basis: FundingAccountOverviewBasis;
    selectedFundingAccountId: string | null;
    subjectKindById: Map<string, AccountSubjectKind | undefined>;
  }): Promise<FundingAccountOverviewTrendPoint[]> {
    const points = await Promise.all(
      input.periods.map(async (period) => {
        const metrics = createEmptyMetrics(0);

        if (input.basis === 'COLLECTED_TRANSACTIONS') {
          const transactions = await this.readCollectedTransactions(
            input,
            period.id
          );
          for (const transaction of transactions) {
            if (
              input.selectedFundingAccountId &&
              transaction.fundingAccountId !== input.selectedFundingAccountId
            ) {
              continue;
            }
            applyCollectedTransactionFlow(metrics, transaction);
          }
        } else {
          const journalEntries = await this.readJournalEntries(
            input,
            period.id
          );
          for (const journalEntry of journalEntries) {
            applyJournalEntryFlow(
              metrics,
              journalEntry,
              input.subjectKindById,
              {
                selectedFundingAccountId: input.selectedFundingAccountId
              }
            );
          }
        }

        const closingBalanceByAccountId =
          await this.readClosingBalanceByAccountId(period.id);
        const closingBalanceWon =
          closingBalanceByAccountId.size === 0
            ? null
            : input.selectedFundingAccountId
              ? (closingBalanceByAccountId.get(
                  input.selectedFundingAccountId
                ) ?? null)
              : sumMoneyWon([...closingBalanceByAccountId.values()]);
        const netFlowWon = calculateNetFlow(metrics);

        return {
          periodId: period.id,
          monthLabel: `${period.year}-${String(period.month).padStart(2, '0')}`,
          periodStatus: period.status,
          incomeWon: metrics.incomeWon,
          expenseWon: metrics.expenseWon,
          netFlowWon,
          closingBalanceWon,
          isOfficial: period.status === AccountingPeriodStatus.LOCKED
        };
      })
    );

    return points.reverse();
  }
}

function normalizeBasis(value?: string): FundingAccountOverviewBasis {
  return value === 'POSTED_JOURNALS'
    ? 'POSTED_JOURNALS'
    : 'COLLECTED_TRANSACTIONS';
}

function buildInitialMetricsByAccountId(
  accounts: LiveFundingAccountRecord[],
  openingBalanceByAccountId: Map<string, number>
) {
  return new Map(
    accounts.map((account) => [
      account.id,
      createEmptyMetrics(
        fromPrismaMoneyWon(openingBalanceByAccountId.get(account.id) ?? 0),
        account.balanceWon
      )
    ])
  );
}

function createEmptyMetrics(
  openingBalanceWon = 0,
  liveBalanceWon = 0
): AccountMetrics {
  return {
    openingBalanceWon,
    liveBalanceWon,
    basisClosingBalanceWon: openingBalanceWon,
    incomeWon: 0,
    expenseWon: 0,
    transferInWon: 0,
    transferOutWon: 0,
    remainingPlannedIncomeWon: 0,
    remainingPlannedExpenseWon: 0,
    transactionCount: 0,
    pendingTransactionCount: 0,
    postedTransactionCount: 0,
    lastActivityOn: null
  };
}

function groupSnapshotLinesByAccountId(lines: BalanceSnapshotLineRecord[]) {
  const grouped = new Map<string, number>();

  for (const line of lines) {
    if (!line.fundingAccountId) {
      continue;
    }

    grouped.set(
      line.fundingAccountId,
      addMoneyWon(
        grouped.get(line.fundingAccountId) ?? 0,
        fromPrismaMoneyWon(line.balanceAmount)
      )
    );
  }

  return grouped;
}

function applyCollectedTransactionMetrics(
  metricsByAccountId: Map<string, AccountMetrics>,
  transaction: CollectedTransactionRecord
) {
  const metrics = metricsByAccountId.get(transaction.fundingAccountId);
  if (!metrics) {
    return;
  }

  applyCollectedTransactionFlow(metrics, transaction);
  metrics.transactionCount += 1;
  applyCollectedTransactionStatusCounters(metrics, transaction.status);
  updateLastActivity(metrics, transaction.occurredOn);
}

function applyCollectedTransactionCounters(
  metricsByAccountId: Map<string, AccountMetrics>,
  transactions: CollectedTransactionRecord[]
) {
  for (const transaction of transactions) {
    const metrics = metricsByAccountId.get(transaction.fundingAccountId);
    if (!metrics) {
      continue;
    }

    applyCollectedTransactionStatusCounters(metrics, transaction.status);
    updateLastActivity(metrics, transaction.occurredOn);
  }
}

function applyCollectedTransactionFlow(
  metrics: AccountMetrics,
  transaction: CollectedTransactionRecord
) {
  const amountWon = fromPrismaMoneyWon(transaction.amount);

  switch (transaction.ledgerTransactionType.flowKind) {
    case 'INCOME':
      metrics.incomeWon = addMoneyWon(metrics.incomeWon, amountWon);
      break;
    case 'EXPENSE':
      metrics.expenseWon = addMoneyWon(metrics.expenseWon, amountWon);
      break;
    case 'TRANSFER':
      metrics.transferOutWon = addMoneyWon(metrics.transferOutWon, amountWon);
      break;
    default:
      metrics.transferOutWon = addMoneyWon(metrics.transferOutWon, amountWon);
      break;
  }
}

function applyCollectedTransactionStatusCounters(
  metrics: AccountMetrics,
  status: CollectedTransactionStatus
) {
  if (isPostedLikeCollectedTransactionStatus(status)) {
    metrics.postedTransactionCount += 1;
    return;
  }

  metrics.pendingTransactionCount += 1;
}

function isPostedLikeCollectedTransactionStatus(
  status: CollectedTransactionStatus
) {
  return (
    status === CollectedTransactionStatus.POSTED ||
    status === CollectedTransactionStatus.CORRECTED ||
    status === CollectedTransactionStatus.LOCKED
  );
}

function applyJournalEntryMetrics(
  metricsByAccountId: Map<string, AccountMetrics>,
  journalEntry: JournalEntryRecord,
  subjectKindById: Map<string, AccountSubjectKind | undefined>
) {
  if (
    journalEntry.status !== 'POSTED' ||
    isSnapshotJournalEntry(journalEntry)
  ) {
    return;
  }

  for (const line of journalEntry.lines) {
    if (!line.fundingAccountId) {
      continue;
    }

    const metrics = metricsByAccountId.get(line.fundingAccountId);
    if (!metrics) {
      continue;
    }

    const flow = classifyJournalFundingLine(
      line,
      subjectKindById.get(line.accountSubjectId)
    );
    if (!flow) {
      continue;
    }

    applyClassifiedFlow(metrics, flow);
    metrics.transactionCount += 1;
    updateLastActivity(metrics, journalEntry.entryDate);
  }
}

function applyJournalEntryFlow(
  metrics: AccountMetrics,
  journalEntry: JournalEntryRecord,
  subjectKindById: Map<string, AccountSubjectKind | undefined>,
  input?: {
    selectedFundingAccountId?: string | null;
  }
) {
  if (
    journalEntry.status !== 'POSTED' ||
    isSnapshotJournalEntry(journalEntry)
  ) {
    return;
  }

  for (const line of journalEntry.lines) {
    if (!line.fundingAccountId) {
      continue;
    }

    if (
      input?.selectedFundingAccountId &&
      line.fundingAccountId !== input.selectedFundingAccountId
    ) {
      continue;
    }

    const flow = classifyJournalFundingLine(
      line,
      subjectKindById.get(line.accountSubjectId)
    );
    if (flow) {
      applyClassifiedFlow(metrics, flow);
    }
  }
}

function isSnapshotJournalEntry(journalEntry: JournalEntryRecord) {
  return (
    journalEntry.sourceKind === 'OPENING_BALANCE' ||
    journalEntry.sourceKind === 'CARRY_FORWARD'
  );
}

function classifyJournalFundingLine(
  line: {
    debitAmount: PrismaMoneyLike;
    creditAmount: PrismaMoneyLike;
  },
  subjectKind: AccountSubjectKind | undefined
): ClassifiedFundingFlow | null {
  if (!subjectKind) {
    return null;
  }

  const debitAmount = fromPrismaMoneyWon(line.debitAmount);
  const creditAmount = fromPrismaMoneyWon(line.creditAmount);

  if (debitAmount === creditAmount) {
    return null;
  }

  if (subjectKind === 'ASSET') {
    return debitAmount > creditAmount
      ? {
          flowKind: 'INCOME',
          amountWon: subtractMoneyWon(debitAmount, creditAmount)
        }
      : {
          flowKind: 'EXPENSE',
          amountWon: subtractMoneyWon(creditAmount, debitAmount)
        };
  }

  if (subjectKind === 'LIABILITY') {
    return creditAmount > debitAmount
      ? {
          flowKind: 'EXPENSE',
          amountWon: subtractMoneyWon(creditAmount, debitAmount)
        }
      : {
          flowKind: 'TRANSFER',
          amountWon: subtractMoneyWon(debitAmount, creditAmount)
        };
  }

  return debitAmount > creditAmount
    ? {
        flowKind: 'TRANSFER',
        amountWon: subtractMoneyWon(debitAmount, creditAmount)
      }
    : {
        flowKind: 'ADJUSTMENT',
        amountWon: subtractMoneyWon(creditAmount, debitAmount)
      };
}

function applyClassifiedFlow(
  metrics: AccountMetrics,
  flow: ClassifiedFundingFlow
) {
  switch (flow.flowKind) {
    case 'INCOME':
      metrics.incomeWon = addMoneyWon(metrics.incomeWon, flow.amountWon);
      break;
    case 'EXPENSE':
      metrics.expenseWon = addMoneyWon(metrics.expenseWon, flow.amountWon);
      break;
    case 'TRANSFER':
      metrics.transferInWon = addMoneyWon(
        metrics.transferInWon,
        flow.amountWon
      );
      break;
    case 'ADJUSTMENT':
    default:
      metrics.transferOutWon = addMoneyWon(
        metrics.transferOutWon,
        flow.amountWon
      );
      break;
  }
}

function applyRemainingPlanMetrics(
  metricsByAccountId: Map<string, AccountMetrics>,
  planItems: PlanItemRecord[],
  ledgerTransactionTypeById: Map<
    string,
    {
      flowKind: LedgerTransactionFlowKind;
    }
  >
) {
  for (const planItem of planItems) {
    if (
      planItem.status === 'CONFIRMED' ||
      planItem.status === 'SKIPPED' ||
      planItem.status === 'EXPIRED'
    ) {
      continue;
    }

    const metrics = metricsByAccountId.get(planItem.fundingAccountId);
    const flowKind = ledgerTransactionTypeById.get(
      planItem.ledgerTransactionTypeId
    )?.flowKind;

    if (!metrics || !flowKind) {
      continue;
    }

    const amountWon = fromPrismaMoneyWon(planItem.plannedAmount);

    if (flowKind === 'INCOME') {
      metrics.remainingPlannedIncomeWon = addMoneyWon(
        metrics.remainingPlannedIncomeWon,
        amountWon
      );
    } else if (flowKind === 'EXPENSE') {
      metrics.remainingPlannedExpenseWon = addMoneyWon(
        metrics.remainingPlannedExpenseWon,
        amountWon
      );
    }
  }
}

function finalizeAccountClosingBalances(input: {
  basis: FundingAccountOverviewBasis;
  targetPeriod: PeriodRecord;
  metricsByAccountId: Map<string, AccountMetrics>;
  closingBalanceByAccountId: Map<string, number>;
}) {
  for (const [accountId, metrics] of input.metricsByAccountId) {
    const calculatedClosingBalanceWon = addMoneyWon(
      metrics.openingBalanceWon,
      calculateNetFlow(metrics)
    );

    metrics.basisClosingBalanceWon =
      input.basis === 'POSTED_JOURNALS' &&
      input.targetPeriod.status === AccountingPeriodStatus.LOCKED &&
      input.closingBalanceByAccountId.has(accountId)
        ? (input.closingBalanceByAccountId.get(accountId) ?? 0)
        : calculatedClosingBalanceWon;
  }
}

function calculateNetFlow(
  metrics: Pick<
    AccountMetrics,
    'incomeWon' | 'expenseWon' | 'transferInWon' | 'transferOutWon'
  >
) {
  return subtractMoneyWon(
    addMoneyWon(metrics.incomeWon, metrics.transferInWon),
    addMoneyWon(metrics.expenseWon, metrics.transferOutWon)
  );
}

function calculateExpectedClosingBalance(metrics: AccountMetrics) {
  return subtractMoneyWon(
    addMoneyWon(
      metrics.basisClosingBalanceWon,
      metrics.remainingPlannedIncomeWon
    ),
    metrics.remainingPlannedExpenseWon
  );
}

function buildAccountItem(
  account: LiveFundingAccountRecord,
  metrics: AccountMetrics = createEmptyMetrics(0, account.balanceWon)
): FundingAccountOverviewAccountItem {
  const netFlowWon = calculateNetFlow(metrics);

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    status: account.status,
    bootstrapStatus: account.bootstrapStatus ?? 'NOT_REQUIRED',
    openingBalanceWon: metrics.openingBalanceWon,
    liveBalanceWon: metrics.liveBalanceWon,
    basisClosingBalanceWon: metrics.basisClosingBalanceWon,
    incomeWon: metrics.incomeWon,
    expenseWon: metrics.expenseWon,
    transferInWon: metrics.transferInWon,
    transferOutWon: metrics.transferOutWon,
    netFlowWon,
    remainingPlannedIncomeWon: metrics.remainingPlannedIncomeWon,
    remainingPlannedExpenseWon: metrics.remainingPlannedExpenseWon,
    expectedClosingBalanceWon: calculateExpectedClosingBalance(metrics),
    transactionCount: metrics.transactionCount,
    pendingTransactionCount: metrics.pendingTransactionCount,
    postedTransactionCount: metrics.postedTransactionCount,
    lastActivityOn: metrics.lastActivityOn?.toISOString().slice(0, 10) ?? null
  };
}

function buildTotals(
  scopedAccounts: FundingAccountOverviewAccountItem[]
): FundingAccountOverviewTotals {
  return {
    fundingAccountCount: scopedAccounts.length,
    activeFundingAccountCount: scopedAccounts.filter(
      (account) => account.status === 'ACTIVE'
    ).length,
    openingBalanceWon: sumMoneyWon(
      scopedAccounts.map((account) => account.openingBalanceWon)
    ),
    liveBalanceWon: sumMoneyWon(
      scopedAccounts.map((account) => account.liveBalanceWon)
    ),
    basisClosingBalanceWon: sumMoneyWon(
      scopedAccounts.map((account) => account.basisClosingBalanceWon)
    ),
    incomeWon: sumMoneyWon(scopedAccounts.map((account) => account.incomeWon)),
    expenseWon: sumMoneyWon(
      scopedAccounts.map((account) => account.expenseWon)
    ),
    transferInWon: sumMoneyWon(
      scopedAccounts.map((account) => account.transferInWon)
    ),
    transferOutWon: sumMoneyWon(
      scopedAccounts.map((account) => account.transferOutWon)
    ),
    netFlowWon: sumMoneyWon(
      scopedAccounts.map((account) => account.netFlowWon)
    ),
    remainingPlannedIncomeWon: sumMoneyWon(
      scopedAccounts.map((account) => account.remainingPlannedIncomeWon)
    ),
    remainingPlannedExpenseWon: sumMoneyWon(
      scopedAccounts.map((account) => account.remainingPlannedExpenseWon)
    ),
    expectedClosingBalanceWon: sumMoneyWon(
      scopedAccounts.map((account) => account.expectedClosingBalanceWon)
    ),
    transactionCount: scopedAccounts.reduce(
      (count, account) => count + account.transactionCount,
      0
    ),
    pendingTransactionCount: scopedAccounts.reduce(
      (count, account) => count + account.pendingTransactionCount,
      0
    ),
    postedTransactionCount: scopedAccounts.reduce(
      (count, account) => count + account.postedTransactionCount,
      0
    )
  };
}

function buildTransactionRows(input: {
  basis: FundingAccountOverviewBasis;
  selectedFundingAccountId: string | null;
  accountById: Map<string, LiveFundingAccountRecord>;
  collectedTransactions: CollectedTransactionRecord[];
  journalEntries: JournalEntryRecord[];
  subjectKindById: Map<string, AccountSubjectKind | undefined>;
}): FundingAccountOverviewTransactionItem[] {
  if (input.basis === 'COLLECTED_TRANSACTIONS') {
    return input.collectedTransactions
      .filter(
        (transaction) =>
          !input.selectedFundingAccountId ||
          transaction.fundingAccountId === input.selectedFundingAccountId
      )
      .map((transaction) => ({
        id: transaction.id,
        businessDate: transaction.occurredOn.toISOString().slice(0, 10),
        title: transaction.title,
        fundingAccountId: transaction.fundingAccountId,
        fundingAccountName: transaction.fundingAccount.name,
        flowKind: transaction.ledgerTransactionType.flowKind,
        amountWon: fromPrismaMoneyWon(transaction.amount),
        categoryName: transaction.category?.name ?? null,
        status: transaction.status,
        sourceKind: 'COLLECTED_TRANSACTION',
        journalEntryId: transaction.postedJournalEntry?.id ?? null,
        journalEntryNumber: transaction.postedJournalEntry?.entryNumber ?? null
      }));
  }

  const collectedById = new Map(
    input.collectedTransactions.map((transaction) => [
      transaction.id,
      transaction
    ])
  );
  const rows: FundingAccountOverviewTransactionItem[] = [];

  for (const journalEntry of input.journalEntries) {
    if (
      journalEntry.status !== 'POSTED' ||
      isSnapshotJournalEntry(journalEntry)
    ) {
      continue;
    }

    const sourceTransaction = journalEntry.sourceCollectedTransactionId
      ? (collectedById.get(journalEntry.sourceCollectedTransactionId) ?? null)
      : null;

    for (const line of journalEntry.lines) {
      if (!line.fundingAccountId) {
        continue;
      }

      if (
        input.selectedFundingAccountId &&
        line.fundingAccountId !== input.selectedFundingAccountId
      ) {
        continue;
      }

      const flow = classifyJournalFundingLine(
        line,
        input.subjectKindById.get(line.accountSubjectId)
      );
      const account = input.accountById.get(line.fundingAccountId);

      if (!flow || !account) {
        continue;
      }

      rows.push({
        id: `${journalEntry.id}:${line.id}`,
        businessDate: journalEntry.entryDate.toISOString().slice(0, 10),
        title:
          sourceTransaction?.title ??
          line.description ??
          journalEntry.memo ??
          journalEntry.entryNumber,
        fundingAccountId: line.fundingAccountId,
        fundingAccountName: account.name,
        flowKind: flow.flowKind,
        amountWon: flow.amountWon,
        categoryName: sourceTransaction?.category?.name ?? null,
        status: journalEntry.status,
        sourceKind: journalEntry.sourceKind,
        journalEntryId: journalEntry.id,
        journalEntryNumber: journalEntry.entryNumber
      });
    }
  }

  return rows.sort((left, right) =>
    left.businessDate === right.businessDate
      ? left.title.localeCompare(right.title)
      : right.businessDate.localeCompare(left.businessDate)
  );
}

function buildCategoryBreakdown(input: {
  basis: FundingAccountOverviewBasis;
  selectedFundingAccountId: string | null;
  transactions: CollectedTransactionRecord[];
}): FundingAccountOverviewCategoryItem[] {
  const grouped = new Map<string, FundingAccountOverviewCategoryItem>();

  for (const transaction of input.transactions) {
    if (
      input.selectedFundingAccountId &&
      transaction.fundingAccountId !== input.selectedFundingAccountId
    ) {
      continue;
    }

    if (
      input.basis === 'POSTED_JOURNALS' &&
      !transaction.postedJournalEntry?.id
    ) {
      continue;
    }

    const flowKind = transaction.ledgerTransactionType.flowKind;
    if (flowKind !== 'INCOME' && flowKind !== 'EXPENSE') {
      continue;
    }

    const categoryName = transaction.category?.name ?? '미분류';
    const key = `${flowKind}:${categoryName}`;
    const existing =
      grouped.get(key) ??
      ({
        categoryName,
        flowKind,
        amountWon: 0,
        transactionCount: 0
      } satisfies FundingAccountOverviewCategoryItem);

    existing.amountWon = addMoneyWon(
      existing.amountWon,
      fromPrismaMoneyWon(transaction.amount)
    );
    existing.transactionCount += 1;
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .sort((left, right) => {
      if (left.amountWon === right.amountWon) {
        return left.categoryName.localeCompare(right.categoryName);
      }

      return right.amountWon > left.amountWon ? 1 : -1;
    })
    .slice(0, 8);
}

function buildWarnings(input: {
  basis: FundingAccountOverviewBasis;
  period: PeriodRecord;
  hasOpeningBalanceSnapshot: boolean;
  pendingTransactionCount: number;
  selectedFundingAccountId: string | null;
  selectedFundingAccountName: string | null;
}) {
  const warnings: string[] = [];
  const monthLabel = `${input.period.year}-${String(input.period.month).padStart(2, '0')}`;

  if (
    input.basis === 'POSTED_JOURNALS' &&
    input.period.status !== AccountingPeriodStatus.LOCKED
  ) {
    warnings.push(
      `${monthLabel}은(는) 아직 잠금 전 기간이라 확정 전표 기준 수치는 현재까지 POSTED 처리된 전표만 반영합니다.`
    );
  }

  if (input.basis === 'POSTED_JOURNALS' && input.pendingTransactionCount > 0) {
    warnings.push(
      `아직 전표로 확정되지 않은 수집 거래 ${input.pendingTransactionCount}건은 공식 기준 합계에서 제외됩니다.`
    );
  }

  if (!input.hasOpeningBalanceSnapshot) {
    warnings.push(
      '선택한 기간의 오프닝 잔액 스냅샷이 없어 시작 잔액은 0원 기준으로 표시됩니다.'
    );
  }

  if (input.selectedFundingAccountId && input.selectedFundingAccountName) {
    warnings.push(
      `${input.selectedFundingAccountName} 자금수단만 필터링한 통계입니다. 전체 합계와 비교할 때 범위를 구분해 주세요.`
    );
  }

  return warnings;
}

function updateLastActivity(metrics: AccountMetrics, activityDate: Date) {
  if (
    !metrics.lastActivityOn ||
    activityDate.getTime() > metrics.lastActivityOn.getTime()
  ) {
    metrics.lastActivityOn = activityDate;
  }
}
