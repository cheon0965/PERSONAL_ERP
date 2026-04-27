import { addMoneyWon, subtractMoneyWon, sumMoneyWon } from '@personal-erp/money';
import {
  CollectedTransactionStatus,
  type LedgerTransactionFlowKind
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { readParsedImportedRowPayload } from '../import-batches/import-batch.policy';

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
  | 'importedRow'
  | 'journalEntry'
  | 'accountSubject'
>;

type FundingBalanceAnchor =
  | {
      source: 'SNAPSHOT_OPENING' | 'SNAPSHOT_CLOSING';
      balanceWon: number;
      moment: Date;
    }
  | {
      source: 'IMPORTED_BALANCE_AFTER';
      balanceWon: number;
      moment: Date;
      collectedTransactionId: string;
      rowNumber: number | null;
    };

type ImportedRowBalanceMetadata = {
  balanceAfter: number | null;
  signedAmount: number | null;
  moment: Date | null;
  rowNumber: number | null;
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
 * 공식 장부 잔액은 마감/전표 기준이지만, 운영 화면에서는 아직 전표가 되지 않은 수집 거래와
 * 업로드 원본의 거래후잔액도 함께 보여줘야 합니다. 그래서 가장 신뢰할 수 있는 anchor를 먼저 고르고,
 * 그 이후의 POSTED 전표와 미확정 수집 거래 증감만 더해 중복 반영을 피합니다.
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
        importedRowId: true,
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

  const importedRowIds = [
    ...new Set(
      collectedTransactions
        .flatMap((transaction) =>
          transaction.importedRowId ? [transaction.importedRowId] : []
        )
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  ];
  const importedRows =
    importedRowIds.length === 0
      ? []
      : await client.importedRow.findMany({
          where: {
            id: {
              in: importedRowIds
            }
          },
          select: {
            id: true,
            rowNumber: true,
            rawPayload: true
          }
        });
  const importedMetadataById = new Map(
    importedRows.map((row) => [row.id, readImportedRowBalanceMetadata(row)])
  );
  const accountSubjectKindById = new Map(
    accountSubjects.map((subject) => [subject.id, subject.subjectKind])
  );

  const snapshotAnchorByAccountId = await buildSnapshotAnchorByAccountId(
    client,
    periods,
    accountIds
  );
  const importedAnchorByAccountId = buildImportedAnchorByAccountId(
    collectedTransactions,
    importedMetadataById,
    accountIds
  );
  const chosenAnchorByAccountId = new Map<string, FundingBalanceAnchor>();

  // 실시간 잔액은 "가장 믿을 수 있는 기준점"을 먼저 고른 뒤 그 이후의 증감만 더한다.
  // 기준점은 마감/오프닝 스냅샷 또는 업로드 거래후잔액이며, 저장된 잔액이 있으면 보수적으로 그대로 둔다.
  for (const accountId of accountIds) {
    const storedBalanceWon = storedBalanceByAccountId.get(accountId) ?? 0;
    const snapshotAnchor = snapshotAnchorByAccountId.get(accountId) ?? null;
    const importedAnchor = importedAnchorByAccountId.get(accountId) ?? null;
    const chosenAnchor = chooseLiveFundingBalanceAnchor({
      importedAnchor,
      snapshotAnchor,
      storedBalanceWon
    });

    if (chosenAnchor) {
      chosenAnchorByAccountId.set(accountId, chosenAnchor);
    }
  }

  if (chosenAnchorByAccountId.size === 0) {
    return accounts.map((account) => ({
      ...account,
      balanceWon: storedBalanceByAccountId.get(account.id) ?? 0
    }));
  }

  const journalDeltaByAccountId = new Map<string, number>();

  // 확정 전표는 공식 잔액 변동이다. 기준점 이전 전표는 이미 스냅샷/거래후잔액에 반영됐다고 보고 제외한다.
  for (const journalEntry of journalEntries) {
    if (journalEntry.status !== 'POSTED') {
      continue;
    }

    for (const line of journalEntry.lines) {
      if (!line.fundingAccountId || !accountIds.has(line.fundingAccountId)) {
        continue;
      }

      const anchor = chosenAnchorByAccountId.get(line.fundingAccountId);
      if (
        anchor &&
        !isFundingBalanceEventAfterAnchor(
          {
            moment: journalEntry.entryDate,
            collectedTransactionId:
              journalEntry.sourceCollectedTransactionId ?? null
          },
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
  // 업로드 행에 signedAmount가 있으면 은행/카드 원본의 부호를 우선 사용한다.
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

    const importedMetadata =
      transaction.importedRowId != null
        ? importedMetadataById.get(transaction.importedRowId) ?? null
        : null;
    const delta = resolvePendingCollectedTransactionDelta(
      fromPrismaMoneyWon(transaction.amount),
      transaction.ledgerTransactionType.flowKind,
      importedMetadata
    );

    if (delta === 0) {
      continue;
    }

    const anchor = chosenAnchorByAccountId.get(transaction.fundingAccountId);

    if (
      anchor &&
      !isFundingBalanceEventAfterAnchor(
        {
          moment:
            importedMetadata?.moment ??
            normalizeDateOnlyMoment(transaction.occurredOn),
          rowNumber: importedMetadata?.rowNumber ?? null,
          collectedTransactionId: transaction.id
        },
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
  source: Extract<FundingBalanceAnchor['source'], 'SNAPSHOT_OPENING' | 'SNAPSHOT_CLOSING'>;
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

function buildImportedAnchorByAccountId(
  collectedTransactions: Array<{
    id: string;
    fundingAccountId: string;
    occurredOn: Date;
    importedRowId: string | null;
  }>,
  importedMetadataById: Map<string, ImportedRowBalanceMetadata>,
  accountIds: Set<string>
) {
  const anchors = new Map<string, FundingBalanceAnchor>();

  for (const transaction of collectedTransactions) {
    if (
      !accountIds.has(transaction.fundingAccountId) ||
      !transaction.importedRowId
    ) {
      continue;
    }

    const importedMetadata = importedMetadataById.get(transaction.importedRowId);

    if (
      importedMetadata?.balanceAfter == null ||
      importedMetadata.moment == null
    ) {
      continue;
    }

    const candidateAnchor: FundingBalanceAnchor = {
      source: 'IMPORTED_BALANCE_AFTER',
      balanceWon: importedMetadata.balanceAfter,
      moment: importedMetadata.moment,
      collectedTransactionId: transaction.id,
      rowNumber: importedMetadata.rowNumber
    };
    const existingAnchor = anchors.get(transaction.fundingAccountId) ?? null;

    if (
      !existingAnchor ||
      compareFundingBalanceAnchor(candidateAnchor, existingAnchor) > 0
    ) {
      anchors.set(transaction.fundingAccountId, candidateAnchor);
    }
  }

  return anchors;
}

function chooseLiveFundingBalanceAnchor(input: {
  importedAnchor: FundingBalanceAnchor | null;
  snapshotAnchor: FundingBalanceAnchor | null;
  storedBalanceWon: number;
}) {
  // 업로드 거래후잔액이 스냅샷보다 최신이면 그 값을 기준점으로 삼는다.
  // 저장 잔액이 0이 아닌 기존 계좌는 아직 기준점 전환을 보수적으로 적용하지 않는다.
  if (
    input.importedAnchor &&
    (!input.snapshotAnchor ||
      compareFundingBalanceAnchor(
        input.importedAnchor,
        input.snapshotAnchor
      ) >= 0)
  ) {
    return input.importedAnchor;
  }

  if (input.storedBalanceWon === 0) {
    return input.snapshotAnchor;
  }

  return null;
}

function compareFundingBalanceAnchor(
  left: FundingBalanceAnchor,
  right: FundingBalanceAnchor
) {
  const momentDiff = left.moment.getTime() - right.moment.getTime();

  if (momentDiff !== 0) {
    return momentDiff;
  }

  const anchorPriority = (anchor: FundingBalanceAnchor) => {
    switch (anchor.source) {
      case 'SNAPSHOT_OPENING':
        return 0;
      case 'IMPORTED_BALANCE_AFTER':
        return 1;
      case 'SNAPSHOT_CLOSING':
        return 2;
      default:
        return 0;
    }
  };
  const priorityDiff = anchorPriority(left) - anchorPriority(right);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (
    left.source === 'IMPORTED_BALANCE_AFTER' &&
    right.source === 'IMPORTED_BALANCE_AFTER'
  ) {
    return (left.rowNumber ?? 0) - (right.rowNumber ?? 0);
  }

  return 0;
}

function isFundingBalanceEventAfterAnchor(
  event: {
    moment: Date;
    rowNumber?: number | null;
    collectedTransactionId?: string | null;
  },
  anchor: FundingBalanceAnchor
) {
  const momentDiff = event.moment.getTime() - anchor.moment.getTime();

  if (momentDiff > 0) {
    return true;
  }

  if (momentDiff < 0) {
    return false;
  }

  if (anchor.source !== 'IMPORTED_BALANCE_AFTER') {
    return true;
  }

  if (
    event.collectedTransactionId &&
    event.collectedTransactionId === anchor.collectedTransactionId
  ) {
    return false;
  }

  if (event.rowNumber != null && anchor.rowNumber != null) {
    return event.rowNumber > anchor.rowNumber;
  }

  return false;
}

function resolvePendingCollectedTransactionDelta(
  amountWon: number,
  flowKind: LedgerTransactionFlowKind,
  importedMetadata: ImportedRowBalanceMetadata | null
) {
  // 업로드 원본이 제공한 signedAmount는 카드/계좌 방향을 이미 반영한 값이다.
  // 없을 때만 거래유형 흐름으로 수입은 +, 지출은 -를 계산한다.
  if (importedMetadata?.signedAmount != null) {
    return importedMetadata.signedAmount;
  }

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

function readImportedRowBalanceMetadata(row: {
  rowNumber: number;
  rawPayload: unknown;
}): ImportedRowBalanceMetadata {
  const parsed = readParsedImportedRowPayload(row.rawPayload as never);

  return {
    balanceAfter:
      typeof parsed?.balanceAfter === 'number' ? parsed.balanceAfter : null,
    signedAmount:
      typeof parsed?.signedAmount === 'number' ? parsed.signedAmount : null,
    moment: readImportedRowMoment(parsed?.occurredAt, parsed?.occurredOn),
    rowNumber: Number.isInteger(row.rowNumber) ? row.rowNumber : null
  };
}

function readImportedRowMoment(
  occurredAt: string | null | undefined,
  occurredOn: string | null | undefined
) {
  if (occurredAt) {
    const parsedOccurredAt = new Date(occurredAt);

    if (!Number.isNaN(parsedOccurredAt.getTime())) {
      return parsedOccurredAt;
    }
  }

  if (!occurredOn) {
    return null;
  }

  const parsedOccurredOn = new Date(`${occurredOn}T00:00:00.000Z`);
  return Number.isNaN(parsedOccurredOn.getTime()) ? null : parsedOccurredOn;
}

function normalizeDateOnlyMoment(value: Date) {
  return new Date(value.toISOString());
}
