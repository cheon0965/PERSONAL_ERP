import { InternalServerErrorException, Injectable } from '@nestjs/common';
import type {
  CollectedTransactionPostingStatus,
  CollectedTransactionSourceKind,
  CollectedTransactionType
} from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  LedgerTransactionFlowKind
} from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CollectedTransactionWorkspaceScope,
  CreateCollectedTransactionRecord,
  StoredCollectedTransaction
} from '../../application/ports/collected-transaction-store.port';
import { CollectedTransactionStorePort } from '../../application/ports/collected-transaction-store.port';

type CollectedTransactionRecord = {
  id: string;
  occurredOn: Date;
  title: string;
  amount: number;
  status: CollectedTransactionStatus;
  importBatchId: string | null;
  matchedPlanItemId: string | null;
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

@Injectable()
export class PrismaCollectedTransactionStoreAdapter
  implements CollectedTransactionStorePort
{
  constructor(private readonly prisma: PrismaService) {}

  async findRecentInWorkspace(
    workspace: CollectedTransactionWorkspaceScope
  ): Promise<StoredCollectedTransaction[]> {
    const transactions = await this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        occurredOn: true,
        title: true,
        amount: true,
        status: true,
        importBatchId: true,
        matchedPlanItemId: true,
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
      },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });

    return transactions.map(mapCollectedTransactionRecordToStoredTransaction);
  }

  async createInWorkspace(
    record: CreateCollectedTransactionRecord
  ): Promise<StoredCollectedTransaction> {
    const ledgerTransactionTypeId =
      await this.findLedgerTransactionTypeId(record);

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
        status: CollectedTransactionStatus.COLLECTED,
        memo: record.memo
      },
      select: {
        id: true,
        occurredOn: true,
        title: true,
        amount: true,
        status: true,
        importBatchId: true,
        matchedPlanItemId: true,
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
      }
    });

    return mapCollectedTransactionRecordToStoredTransaction(created);
  }

  private async findLedgerTransactionTypeId(
    record: CreateCollectedTransactionRecord
  ): Promise<string> {
    const ledgerTransactionType = await this.prisma.ledgerTransactionType.findFirst(
      {
        where: {
          tenantId: record.tenantId,
          ledgerId: record.ledgerId,
          code: mapCollectedTransactionTypeToLedgerTransactionCode(record.type),
          isActive: true
        },
        select: {
          id: true
        }
      }
    );

    if (!ledgerTransactionType) {
      throw new InternalServerErrorException(
        '현재 Ledger에 수집 거래용 기본 거래유형 마스터가 준비되어 있지 않습니다.'
      );
    }

    return ledgerTransactionType.id;
  }
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
    amountWon: transaction.amount,
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
    postedJournalEntryId: transaction.postedJournalEntry?.id ?? null,
    postedJournalEntryNumber: transaction.postedJournalEntry?.entryNumber ?? null
  };
}

function mapCollectedTransactionTypeToLedgerTransactionCode(
  type: CollectedTransactionType
): string {
  switch (type) {
    case 'INCOME':
      return 'INCOME_BASIC';
    case 'TRANSFER':
      return 'TRANSFER_BASIC';
    case 'EXPENSE':
    default:
      return 'EXPENSE_BASIC';
  }
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
    case LedgerTransactionFlowKind.EXPENSE:
    default:
      return 'EXPENSE';
  }
}

function mapCollectedTransactionSourceKind(
  transaction: Pick<CollectedTransactionRecord, 'importBatchId' | 'matchedPlanItemId'>
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
    case CollectedTransactionStatus.POSTED:
      return 'POSTED';
    case CollectedTransactionStatus.CORRECTED:
    case CollectedTransactionStatus.LOCKED:
      return 'CANCELLED';
    case CollectedTransactionStatus.COLLECTED:
    case CollectedTransactionStatus.REVIEWED:
    case CollectedTransactionStatus.READY_TO_POST:
    default:
      return 'PENDING';
  }
}
