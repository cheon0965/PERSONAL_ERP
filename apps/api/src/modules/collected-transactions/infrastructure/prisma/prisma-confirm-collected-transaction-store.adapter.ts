import { ConflictException, Injectable } from '@nestjs/common';
import {
  CollectedTransactionStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../../../accounting-periods/public';
import type { JournalEntryRecord } from '../../../journal-entries/public';
import {
  assertConfirmationAllowed,
  assertConfirmationTransactionFound,
  assertConfirmationTransactionHasPeriod
} from '../../confirm-collected-transaction.validator';
import {
  ConfirmCollectedTransactionStorePort,
  ConfirmTransactionContext,
  type AllocatedConfirmationEntryNumber,
  type ConfirmationCollectedTransaction,
  type ConfirmationWorkspaceScope,
  type CreateConfirmationJournalEntryInput
} from '../../application/ports/confirm-collected-transaction-store.port';

const confirmationCollectedTransactionInclude = {
  period: {
    select: {
      id: true,
      year: true,
      month: true,
      status: true
    }
  },
  fundingAccount: {
    select: {
      id: true,
      name: true
    }
  },
  ledgerTransactionType: {
    select: {
      postingPolicyKey: true
    }
  },
  postedJournalEntry: {
    select: {
      id: true
    }
  }
} satisfies Prisma.CollectedTransactionInclude;

type PrismaConfirmationRecord = Prisma.CollectedTransactionGetPayload<{
  include: typeof confirmationCollectedTransactionInclude;
}>;

function mapPrismaToConfirmationCollectedTransaction(
  record: PrismaConfirmationRecord
): ConfirmationCollectedTransaction {
  return {
    id: record.id,
    occurredOn: record.occurredOn,
    title: record.title,
    memo: record.memo,
    amount: fromPrismaMoneyWon(record.amount as PrismaMoneyLike),
    status: record.status,
    matchedPlanItemId: record.matchedPlanItemId,
    period: record.period
      ? {
          id: record.period.id,
          year: record.period.year,
          month: record.period.month,
          status: record.period.status
        }
      : null,
    fundingAccount: {
      id: record.fundingAccount.id,
      name: record.fundingAccount.name
    },
    ledgerTransactionType: {
      postingPolicyKey: record.ledgerTransactionType.postingPolicyKey
    },
    postedJournalEntry: record.postedJournalEntry
      ? { id: record.postedJournalEntry.id }
      : null
  };
}

@Injectable()
export class PrismaConfirmCollectedTransactionStoreAdapter
  implements ConfirmCollectedTransactionStorePort
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {}

  async findForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null> {
    const record = await this.prisma.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      include: confirmationCollectedTransactionInclude
    });

    return record
      ? mapPrismaToConfirmationCollectedTransaction(record)
      : null;
  }

  async findActiveAccountSubjects(
    scope: ConfirmationWorkspaceScope,
    codes: readonly string[]
  ): Promise<Array<{ id: string; code: string }>> {
    return this.prisma.accountSubject.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId,
        code: { in: [...codes] },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });
  }

  async runInTransaction<T>(
    fn: (ctx: ConfirmTransactionContext) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = new PrismaConfirmTransactionContext(
        tx,
        this.accountingPeriodWriteGuard
      );
      return fn(ctx);
    });
  }
}

class PrismaConfirmTransactionContext extends ConfirmTransactionContext {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {
    super();
  }

  async findLatestForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null> {
    const record = await this.tx.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      include: confirmationCollectedTransactionInclude
    });

    return record
      ? mapPrismaToConfirmationCollectedTransaction(record)
      : null;
  }

  async allocateJournalEntryNumber(
    scope: ConfirmationWorkspaceScope,
    periodId: string
  ): Promise<AllocatedConfirmationEntryNumber> {
    const result =
      await this.accountingPeriodWriteGuard.allocateJournalEntryNumberInTransaction(
        this.tx,
        scope,
        periodId
      );

    return {
      period: {
        id: result.period.id,
        year: result.period.year,
        month: result.period.month
      },
      sequence: result.sequence
    };
  }

  async claimForConfirmation(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    currentStatus: CollectedTransactionStatus;
  }): Promise<{ count: number }> {
    const result = await this.tx.collectedTransaction.updateMany({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: [input.currentStatus]
        }
      },
      data: {
        status: CollectedTransactionStatus.POSTED
      }
    });

    return { count: result.count };
  }

  async assertClaimSucceeded(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    updatedCount: number;
  }): Promise<void> {
    if (input.updatedCount === 1) {
      return;
    }

    const current = await this.tx.collectedTransaction.findFirst({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      },
      include: {
        period: {
          select: {
            id: true,
            year: true,
            month: true,
            status: true
          }
        },
        postedJournalEntry: {
          select: {
            id: true
          }
        }
      }
    });

    assertConfirmationTransactionFound(current);
    assertConfirmationTransactionHasPeriod(current);
    assertConfirmationAllowed({
      status: current.status,
      periodStatus: current.period.status,
      postedJournalEntryId: current.postedJournalEntry?.id ?? null
    });

    throw new ConflictException(
      'Collected transaction changed during confirmation. Please retry.'
    );
  }

  async createJournalEntry(
    input: CreateConfirmationJournalEntryInput
  ): Promise<JournalEntryRecord> {
    const created = await this.tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId,
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        sourceKind: input.sourceKind,
        sourceCollectedTransactionId: input.sourceCollectedTransactionId,
        status: input.status,
        memo: input.memo,
        createdByActorType: input.createdByActorType,
        createdByMembershipId: input.createdByMembershipId,
        lines: {
          create: input.lines
        }
      },
      include: {
        sourceCollectedTransaction: {
          select: {
            id: true,
            title: true
          }
        },
        lines: {
          include: {
            accountSubject: {
              select: {
                code: true,
                name: true
              }
            },
            fundingAccount: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            lineNumber: 'asc' as const
          }
        }
      }
    });

    return created as unknown as JournalEntryRecord;
  }

  async markMatchedPlanItemConfirmed(
    matchedPlanItemId: string | null | undefined
  ): Promise<void> {
    if (!matchedPlanItemId) {
      return;
    }

    await this.tx.planItem.update({
      where: {
        id: matchedPlanItemId
      },
      data: {
        status: PlanItemStatus.CONFIRMED
      }
    });
  }
}
