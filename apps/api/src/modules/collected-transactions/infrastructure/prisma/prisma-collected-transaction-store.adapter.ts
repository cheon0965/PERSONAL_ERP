import {
  ConflictException,
  InternalServerErrorException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CollectedTransactionPostingStatus,
  CollectedTransactionSourceKind,
  CollectedTransactionType
} from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  LedgerTransactionFlowKind,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  assertCollectedTransactionCanBeDeleted,
  assertCollectedTransactionCanBeUpdated
} from '../../collected-transaction-transition.policy';
import { mapCollectedTransactionTypeToLedgerTransactionCode } from '../../collected-transaction-type.mapper';
import { resolveManualCollectedTransactionStatus } from '../../manual-collected-transaction-status.policy';
import type {
  CollectedTransactionWorkspaceScope,
  CreateCollectedTransactionRecord,
  StoredCollectedTransaction,
  StoredCollectedTransactionDetail,
  UpdateCollectedTransactionRecord
} from '../../application/ports/collected-transaction-store.port';
import { CollectedTransactionStorePort } from '../../application/ports/collected-transaction-store.port';

type CollectedTransactionRecord = {
  id: string;
  occurredOn: Date;
  title: string;
  amount: PrismaMoneyLike;
  status: CollectedTransactionStatus;
  importBatchId: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItem: {
    title: string;
  } | null;
  postedJournalEntry: {
    id: string;
    entryNumber: string;
  } | null;
  fundingAccount: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  ledgerTransactionType: {
    flowKind: LedgerTransactionFlowKind;
  };
};

type CollectedTransactionDetailRecord = CollectedTransactionRecord & {
  fundingAccountId: string;
  categoryId: string | null;
  memo: string | null;
};

@Injectable()
export class PrismaCollectedTransactionStoreAdapter implements CollectedTransactionStorePort {
  constructor(private readonly prisma: PrismaService) {}

  async findRecentInWorkspace(
    workspace: CollectedTransactionWorkspaceScope
  ): Promise<StoredCollectedTransaction[]> {
    const transactions = await this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: buildCollectedTransactionSelect(),
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }]
    });

    return transactions.map(mapCollectedTransactionRecordToStoredTransaction);
  }

  async findByIdInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<StoredCollectedTransactionDetail | null> {
    const transaction = await this.prisma.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: buildCollectedTransactionDetailSelect()
    });

    return transaction
      ? mapCollectedTransactionRecordToStoredTransactionDetail(transaction)
      : null;
  }

  async createInWorkspace(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction> {
    const ledgerTransactionTypeId = await this.findLedgerTransactionTypeId(
      record.tenantId,
      record.ledgerId,
      record.type
    );

    const created = await this.prisma.collectedTransaction.create({
      data: {
        tenantId: record.tenantId,
        ledgerId: record.ledgerId,
        periodId: record.periodId,
        ledgerTransactionTypeId,
        fundingAccountId: record.fundingAccountId,
        categoryId: record.categoryId,
        title: record.title,
        occurredOn: record.businessDate,
        amount: record.amountWon,
        status: resolveManualCollectedTransactionStatus({
          type: record.type,
          categoryId: record.categoryId
        }),
        memo: record.memo
      },
      select: buildCollectedTransactionSelect()
    });

    return mapCollectedTransactionRecordToStoredTransaction(created);
  }

  async updateInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    record: UpdateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.collectedTransaction.findFirst({
        where: {
          id: record.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          status: true,
          postedJournalEntry: {
            select: {
              id: true
            }
          }
        }
      });

      if (!current) {
        throw new NotFoundException('Collected transaction not found');
      }

      assertCollectedTransactionCanBeUpdated({
        postingStatus: mapCollectedTransactionPostingStatus(current.status),
        postedJournalEntryId: current.postedJournalEntry?.id ?? null
      });

      const ledgerTransactionTypeId =
        await this.findLedgerTransactionTypeIdInClient(
          tx,
          workspace.tenantId,
          workspace.ledgerId,
          record.type
        );

      const result = await tx.collectedTransaction.updateMany({
        where: {
          id: record.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [
              CollectedTransactionStatus.COLLECTED,
              CollectedTransactionStatus.REVIEWED,
              CollectedTransactionStatus.READY_TO_POST
            ]
          }
        },
        data: {
          periodId: record.periodId,
          ledgerTransactionTypeId,
          fundingAccountId: record.fundingAccountId,
          categoryId: record.categoryId,
          title: record.title,
          occurredOn: record.businessDate,
          amount: record.amountWon,
          status: resolveManualCollectedTransactionStatus({
            type: record.type,
            categoryId: record.categoryId
          }),
          memo: record.memo
        }
      });

      if (result.count === 0) {
        const latest = await tx.collectedTransaction.findFirst({
          where: {
            id: record.id,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          select: {
            status: true,
            postedJournalEntry: {
              select: {
                id: true
              }
            }
          }
        });

        if (!latest) {
          throw new NotFoundException('Collected transaction not found');
        }

        assertCollectedTransactionCanBeUpdated({
          postingStatus: mapCollectedTransactionPostingStatus(latest.status),
          postedJournalEntryId: latest.postedJournalEntry?.id ?? null
        });

        throw new ConflictException(
          'Collected transaction could not be updated in the current state.'
        );
      }

      const updated = await tx.collectedTransaction.findFirst({
        where: {
          id: record.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: buildCollectedTransactionSelect()
      });

      if (!updated) {
        throw new NotFoundException('Collected transaction not found');
      }

      return mapCollectedTransactionRecordToStoredTransaction(updated);
    });
  }

  async deleteInWorkspace(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.collectedTransaction.findFirst({
        where: {
          id: collectedTransactionId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          matchedPlanItemId: true,
          status: true,
          postedJournalEntry: {
            select: {
              id: true
            }
          }
        }
      });

      if (!current) {
        return false;
      }

      assertCollectedTransactionCanBeDeleted({
        postingStatus: mapCollectedTransactionPostingStatus(current.status),
        postedJournalEntryId: current.postedJournalEntry?.id ?? null
      });

      const result = await tx.collectedTransaction.deleteMany({
        where: {
          id: collectedTransactionId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [
              CollectedTransactionStatus.COLLECTED,
              CollectedTransactionStatus.REVIEWED,
              CollectedTransactionStatus.READY_TO_POST
            ]
          }
        }
      });

      if (result.count > 0) {
        if (current.matchedPlanItemId) {
          await tx.planItem.update({
            where: {
              id: current.matchedPlanItemId
            },
            data: {
              status: PlanItemStatus.DRAFT
            }
          });
        }

        return true;
      }

      return false;
    });
  }

  private async findLedgerTransactionTypeId(
    tenantId: string,
    ledgerId: string,
    type: CollectedTransactionType
  ): Promise<string> {
    return this.findLedgerTransactionTypeIdInClient(
      this.prisma,
      tenantId,
      ledgerId,
      type
    );
  }

  private async findLedgerTransactionTypeIdInClient(
    client: Pick<Prisma.TransactionClient, 'ledgerTransactionType'>,
    tenantId: string,
    ledgerId: string,
    type: CollectedTransactionType
  ): Promise<string> {
    const ledgerTransactionType = await client.ledgerTransactionType.findFirst({
      where: {
        tenantId,
        ledgerId,
        code: mapCollectedTransactionTypeToLedgerTransactionCode(type),
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!ledgerTransactionType) {
      throw new InternalServerErrorException(
        '현재 Ledger에 수집 거래용 기본 거래유형 마스터가 준비되어 있지 않습니다.'
      );
    }

    return ledgerTransactionType.id;
  }
}

function buildCollectedTransactionSelect() {
  return {
    id: true,
    occurredOn: true,
    title: true,
    amount: true,
    status: true,
    importBatchId: true,
    matchedPlanItemId: true,
    matchedPlanItem: {
      select: {
        title: true
      }
    },
    postedJournalEntry: {
      select: {
        id: true,
        entryNumber: true
      }
    },
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
    }
  } as const;
}

function buildCollectedTransactionDetailSelect() {
  return {
    ...buildCollectedTransactionSelect(),
    fundingAccountId: true,
    categoryId: true,
    memo: true
  } as const;
}

function mapCollectedTransactionRecordToStoredTransaction(
  transaction: CollectedTransactionRecord
): StoredCollectedTransaction {
  return {
    id: transaction.id,
    businessDate: transaction.occurredOn,
    title: transaction.title,
    type: mapLedgerTransactionFlowKindToCollectedTransactionType(
      transaction.ledgerTransactionType.flowKind
    ),
    amountWon: fromPrismaMoneyWon(transaction.amount),
    origin: mapCollectedTransactionSourceKind(transaction),
    status: mapCollectedTransactionPostingStatus(transaction.status),
    account: {
      name: transaction.fundingAccount.name
    },
    category: transaction.category
      ? {
          name: transaction.category.name
        }
      : null,
    matchedPlanItemId: transaction.matchedPlanItemId,
    matchedPlanItemTitle: transaction.matchedPlanItem?.title ?? null,
    postedJournalEntryId: transaction.postedJournalEntry?.id ?? null,
    postedJournalEntryNumber:
      transaction.postedJournalEntry?.entryNumber ?? null
  };
}

function mapCollectedTransactionRecordToStoredTransactionDetail(
  transaction: CollectedTransactionDetailRecord
): StoredCollectedTransactionDetail {
  const base = mapCollectedTransactionRecordToStoredTransaction(transaction);

  return {
    ...base,
    fundingAccountId: transaction.fundingAccountId,
    categoryId: transaction.categoryId,
    memo: transaction.memo
  };
}

function mapLedgerTransactionFlowKindToCollectedTransactionType(
  flowKind: LedgerTransactionFlowKind
): CollectedTransactionType {
  switch (flowKind) {
    case LedgerTransactionFlowKind.INCOME:
      return 'INCOME';
    case LedgerTransactionFlowKind.TRANSFER:
    case LedgerTransactionFlowKind.OPENING_BALANCE:
    case LedgerTransactionFlowKind.CARRY_FORWARD:
      return 'TRANSFER';
    case LedgerTransactionFlowKind.ADJUSTMENT:
      return 'REVERSAL';
    case LedgerTransactionFlowKind.EXPENSE:
    default:
      return 'EXPENSE';
  }
}

function mapCollectedTransactionSourceKind(
  transaction: Pick<
    CollectedTransactionRecord,
    'importBatchId' | 'matchedPlanItemId'
  >
): CollectedTransactionSourceKind {
  if (transaction.importBatchId) {
    return 'IMPORT';
  }

  if (transaction.matchedPlanItemId) {
    return 'RECURRING';
  }

  return 'MANUAL';
}

function mapCollectedTransactionPostingStatus(
  status: CollectedTransactionStatus
): CollectedTransactionPostingStatus {
  switch (status) {
    case CollectedTransactionStatus.COLLECTED:
      return 'COLLECTED';
    case CollectedTransactionStatus.REVIEWED:
      return 'REVIEWED';
    case CollectedTransactionStatus.READY_TO_POST:
      return 'READY_TO_POST';
    case CollectedTransactionStatus.POSTED:
      return 'POSTED';
    case CollectedTransactionStatus.CORRECTED:
      return 'CORRECTED';
    case CollectedTransactionStatus.LOCKED:
      return 'LOCKED';
    default:
      return 'REVIEWED';
  }
}
