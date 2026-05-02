import { addMoneyWon, subtractMoneyWon, sumMoneyWon } from '@personal-erp/money';
import {
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  type LedgerTransactionFlowKind
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';
import { PrismaService } from '../../common/prisma/prisma.service';

type WorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

type FundingAccountRecord = {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'CARD';
  balanceWon: PrismaMoneyLike;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
};

type LiveFundingAccountRecord = Omit<FundingAccountRecord, 'balanceWon'> & {
  balanceWon: number;
};

type FundingAccountBalanceReadClient = Pick<
  PrismaService,
  | 'account'
  | 'accountingPeriod'
  | 'openingBalanceSnapshot'
  | 'closingSnapshot'
  | 'balanceSnapshotLine'
  | 'collectedTransaction'
  | 'journalEntry'
  | 'accountSubject'
>;

type FundingBalanceAnchor = {
  source: 'SNAPSHOT_OPENING' | 'SNAPSHOT_CLOSING';
  balanceWon: number;
  moment: Date;
};

const LIVE_BALANCE_TRANSACTION_STATUSES = [
  CollectedTransactionStatus.COLLECTED,
  CollectedTransactionStatus.REVIEWED,
  CollectedTransactionStatus.READY_TO_POST,
  CollectedTransactionStatus.POSTED,
  CollectedTransactionStatus.LOCKED
] as const;

/**
 * 자금 계좌의 화면용 실시간 잔액을 계산합니다.
 *
 * 잔액의 유일한 출처는 오프닝/마감 스냅샷과 POSTED 전표 증감입니다.
 * 가장 최근 스냅샷을 anchor로 삼고, 그 이후의 전표와 미확정 수집 거래 증감을 더합니다.
 * `sourceKind`가 `OPENING_BALANCE`인 전표는 스냅샷에 이미 반영된 금액이므로 증감액에서 제외합니다.
 */
export async function readWorkspaceFundingAccountLiveBalances(
  client: FundingAccountBalanceReadClient,
  scope: WorkspaceScope,
  input?: {
    includeInactive?: boolean;
  }
): Promise<LiveFundingAccountRecord[]> {
  const accounts = (await client.account.findMany({
    where: {
      tenantId: scope.tenantId,
      ledgerId: scope.ledgerId,
      ...(input?.includeInactive ? {} : { status: 'ACTIVE' })
    },
    orderBy: input?.includeInactive
      ? [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
      : [{ sortOrder: 'asc' }, { name: 'asc' }]
  })) as FundingAccountRecord[];

  if (accounts.length === 0) {
    return [];
  }

  const accountIds = new Set(accounts.map((account) => account.id));
  const storedBalanceByAccountId = new Map(
    accounts.map((account) => [account.id, fromPrismaMoneyWon(account.balanceWon)])
  );

  const [
    periods,
    accountSubjects,
    collectedTransactions,
    journalEntries
  ] = await Promise.all([
    client.accountingPeriod.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    }),
    client.accountSubject.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      select: {
        id: true,
        subjectKind: true
      }
    }),
    client.collectedTransaction.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId,
        status: {
          in: [...LIVE_BALANCE_TRANSACTION_STATUSES]
        }
      },
      select: {
        id: true,
        fundingAccountId: true,
        occurredOn: true,
        amount: true,
        status: true,
        ledgerTransactionType: {
          select: {
            flowKind: true
          }
        },
        postedJournalEntry: {
          select: {
            id: true
          }
        }
      }
    }),
    client.journalEntry.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      include: {
        lines: true
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }]
    })
  ]);

  const accountSubjectKindById = new Map(
    accountSubjects.map((subject) => [subject.id, subject.subjectKind])
  );

  const snapshotAnchorByAccountId = await buildSnapshotAnchorByAccountId(
    client,
    periods,
    accountIds
  );

  const chosenAnchorByAccountId = new Map<string, FundingBalanceAnchor>();

  // 스냅샷 anchor가 있으면 그대로 사용하고, storedBalanceWon이 0인 계좌만 anchor 전환 대상이다.
  for (const accountId of accountIds) {
    const storedBalanceWon = storedBalanceByAccountId.get(accountId) ?? 0;
    const snapshotAnchor = snapshotAnchorByAccountId.get(accountId) ?? null;

    if (storedBalanceWon === 0 && snapshotAnchor) {
      chosenAnchorByAccountId.set(accountId, snapshotAnchor);
    }
  }

  if (chosenAnchorByAccountId.size === 0) {
    return accounts.map((account) => ({
      ...account,
      balanceWon: storedBalanceByAccountId.get(account.id) ?? 0
    }));
  }

  const journalDeltaByAccountId = new Map<string, number>();

  // 확정 전표는 공식 잔액 변동이다. 기준점 이전 전표는 이미 스냅샷에 반영됐다고 보고 제외한다.
  // `sourceKind`가 `OPENING_BALANCE`인 전표는 스냅샷에 이미 반영된 금액이므로 이중 반영을 막는다.
  for (const journalEntry of journalEntries) {
    if (journalEntry.status !== 'POSTED') {
      continue;
    }

    for (const line of journalEntry.lines) {
      if (!line.fundingAccountId || !accountIds.has(line.fundingAccountId)) {
        continue;
      }

      const anchor = chosenAnchorByAccountId.get(line.fundingAccountId);

      // `OPENING_BALANCE` 전표는 스냅샷 기준점이 있을 때 이미 스냅샷에 반영된 금액이므로 제외한다.
      if (
        anchor &&
        journalEntry.sourceKind === JournalEntrySourceKind.OPENING_BALANCE
      ) {
        continue;
      }

      if (
        anchor &&
        !isFundingBalanceEventAfterAnchor(
          { moment: journalEntry.entryDate },
          anchor
        )
      ) {
        continue;
      }

      const subjectKind = accountSubjectKindById.get(line.accountSubjectId);
      if (!subjectKind) {
        continue;
      }

      const delta = projectFundingBalanceJournalDelta({
        subjectKind,
        debitAmount: fromPrismaMoneyWon(line.debitAmount),
        creditAmount: fromPrismaMoneyWon(line.creditAmount)
      });

      journalDeltaByAccountId.set(
        line.fundingAccountId,
        addMoneyWon(journalDeltaByAccountId.get(line.fundingAccountId) ?? 0, delta)
      );
    }
  }

  const pendingDeltaByAccountId = new Map<string, number>();

  // 아직 전표가 되지 않은 수집 거래도 운영 화면에서는 예상 잔액에 반영한다.
  // `flowKind` 기준으로 수입은 +, 지출은 -를 계산한다.
  for (const transaction of collectedTransactions) {
    if (!accountIds.has(transaction.fundingAccountId)) {
      continue;
    }

    if (
      transaction.status === CollectedTransactionStatus.POSTED ||
      transaction.status === CollectedTransactionStatus.LOCKED
    ) {
      continue;
    }

    if (transaction.postedJournalEntry?.id) {
      continue;
    }

    const delta = resolvePendingCollectedTransactionDelta(
      fromPrismaMoneyWon(transaction.amount),
      transaction.ledgerTransactionType.flowKind
    );

    if (delta === 0) {
      continue;
    }

    const anchor = chosenAnchorByAccountId.get(transaction.fundingAccountId);

    if (
      anchor &&
      !isFundingBalanceEventAfterAnchor(
        { moment: normalizeDateOnlyMoment(transaction.occurredOn) },
        anchor
      )
    ) {
      continue;
    }

    pendingDeltaByAccountId.set(
      transaction.fundingAccountId,
      addMoneyWon(
        pendingDeltaByAccountId.get(transaction.fundingAccountId) ?? 0,
        delta
      )
    );
  }

  return accounts.map((account) => {
    const storedBalanceWon = storedBalanceByAccountId.get(account.id) ?? 0;
    const anchor = chosenAnchorByAccountId.get(account.id);

    if (!anchor) {
      return {
        ...account,
        balanceWon: storedBalanceWon
      };
    }

    return {
      ...account,
      balanceWon: sumMoneyWon([
        anchor.balanceWon,
        journalDeltaByAccountId.get(account.id) ?? 0,
        pendingDeltaByAccountId.get(account.id) ?? 0
      ])
    };
  });
}

export async function readWorkspaceCurrentFundingBalanceWon(
  client: FundingAccountBalanceReadClient,
  scope: WorkspaceScope
) {
  const accounts = await readWorkspaceFundingAccountLiveBalances(client, scope, {
    includeInactive: true
  });

  return sumMoneyWon(accounts.map((account) => account.balanceWon));
}

async function buildSnapshotAnchorByAccountId(
  client: FundingAccountBalanceReadClient,
  periods: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>,
  accountIds: Set<string>
) {
  const anchors = new Map<string, FundingBalanceAnchor>();

  // 가장 최근 스냅샷을 계좌별 기준점으로 삼는다. 모든 계좌의 기준점을 찾으면
  // 더 오래된 기간은 볼 필요가 없어 반복을 중단한다.
  for (const period of periods) {
    if (period.status === 'LOCKED') {
      const closingSnapshot = await client.closingSnapshot.findUnique({
        where: {
          periodId: period.id
        }
      });

      if (closingSnapshot) {
        const closingLines = await client.balanceSnapshotLine.findMany({
          where: {
            closingSnapshotId: closingSnapshot.id
          }
        });

        applySnapshotAnchors({
          anchors,
          lines: closingLines,
          moment: normalizeDateOnlyMoment(period.endDate),
          source: 'SNAPSHOT_CLOSING',
          accountIds
        });
      }
    }

    const openingSnapshot = await client.openingBalanceSnapshot.findUnique({
      where: {
        effectivePeriodId: period.id
      }
    });

    if (openingSnapshot) {
      const openingLines = await client.balanceSnapshotLine.findMany({
        where: {
          openingSnapshotId: openingSnapshot.id
        }
      });

      applySnapshotAnchors({
        anchors,
        lines: openingLines,
        moment: normalizeDateOnlyMoment(period.startDate),
        source: 'SNAPSHOT_OPENING',
        accountIds
      });
    }

    if (anchors.size >= accountIds.size) {
      break;
    }
  }

  return anchors;
}

function applySnapshotAnchors(input: {
  anchors: Map<string, FundingBalanceAnchor>;
  lines: Array<{
    fundingAccountId: string | null;
    balanceAmount: PrismaMoneyLike;
  }>;
  moment: Date;
  source: FundingBalanceAnchor['source'];
  accountIds: Set<string>;
}) {
  const groupedBalanceByAccountId = new Map<string, number>();

  for (const line of input.lines) {
    if (
      !line.fundingAccountId ||
      !input.accountIds.has(line.fundingAccountId) ||
      input.anchors.has(line.fundingAccountId)
    ) {
      continue;
    }

    groupedBalanceByAccountId.set(
      line.fundingAccountId,
      addMoneyWon(
        groupedBalanceByAccountId.get(line.fundingAccountId) ?? 0,
        fromPrismaMoneyWon(line.balanceAmount)
      )
    );
  }

  for (const [fundingAccountId, balanceWon] of groupedBalanceByAccountId) {
    input.anchors.set(fundingAccountId, {
      source: input.source,
      balanceWon,
      moment: input.moment
    });
  }
}

function isFundingBalanceEventAfterAnchor(
  event: { moment: Date },
  anchor: FundingBalanceAnchor
) {
  const momentDiff = event.moment.getTime() - anchor.moment.getTime();

  if (momentDiff > 0) {
    return true;
  }

  if (momentDiff < 0) {
    return false;
  }

  // 같은 시점이면 스냅샷 이후 이벤트로 간주한다.
  return true;
}

function resolvePendingCollectedTransactionDelta(
  amountWon: number,
  flowKind: LedgerTransactionFlowKind
) {
  switch (flowKind) {
    case 'INCOME':
      return amountWon;
    case 'EXPENSE':
      return subtractMoneyWon(0, amountWon);
    default:
      return 0;
  }
}

function projectFundingBalanceJournalDelta(input: {
  subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  debitAmount: number;
  creditAmount: number;
}) {
  switch (input.subjectKind) {
    case 'LIABILITY':
    case 'EQUITY':
    case 'INCOME':
      return subtractMoneyWon(input.creditAmount, input.debitAmount);
    case 'ASSET':
    case 'EXPENSE':
    default:
      return subtractMoneyWon(input.debitAmount, input.creditAmount);
  }
}

function normalizeDateOnlyMoment(value: Date) {
  return new Date(value.toISOString());
}
