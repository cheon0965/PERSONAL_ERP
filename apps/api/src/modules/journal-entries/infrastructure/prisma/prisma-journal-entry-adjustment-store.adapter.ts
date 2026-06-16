import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import {
  AccountingPeriodStatus,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus,
  type Prisma
} from '@prisma/client';
import { fromPrismaMoneyWon } from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  type CollectedTransactionStatusValue,
  type CreateJournalEntryAdjustmentInput,
  type JournalEntryAdjustmentRecord,
  JournalEntryAdjustmentContext,
  JournalEntryAdjustmentStorePort,
  type JournalEntryWorkspaceScope
} from '../../application/ports/journal-entry-adjustment-store.port';
import type { JournalAdjustmentLineDraft } from '../../domain/journal-entry-adjustment.policy';
import { mapJournalEntryRecordToItem } from '../mappers/journal-entry-item.mapper';
import {
  journalEntryItemInclude,
  type JournalEntryItemRecord
} from '../models/journal-entry.record';

@Injectable()
export class PrismaJournalEntryAdjustmentStoreAdapter extends JournalEntryAdjustmentStorePort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async runInTransaction<T>(
    fn: (ctx: JournalEntryAdjustmentContext) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction((tx) =>
      fn(new PrismaJournalEntryAdjustmentContext(tx))
    );
  }
}

class PrismaJournalEntryAdjustmentContext extends JournalEntryAdjustmentContext {
  constructor(private readonly tx: Prisma.TransactionClient) {
    super();
  }

  async allocateJournalEntryNumber(
    workspace: JournalEntryWorkspaceScope,
    periodId: string
  ) {
    const period = await this.tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    if (!period) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    assertJournalWritePeriodClaimable(period.status);

    const claimed = await this.tx.accountingPeriod.updateMany({
      where: {
        id: period.id,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.IN_REVIEW]
        }
      },
      data: {
        nextJournalEntrySequence: {
          increment: 1
        }
      }
    });

    if (claimed.count !== 1) {
      throw new ConflictException(
        '운영 기간 상태가 변경되어 전표 번호를 할당하지 못했습니다. 다시 시도해 주세요.'
      );
    }

    const allocated = await this.tx.accountingPeriod.findFirst({
      where: {
        id: period.id,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    if (!allocated) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    return {
      period: {
        id: allocated.id,
        year: allocated.year,
        month: allocated.month
      },
      sequence: allocated.nextJournalEntrySequence - 1
    };
  }

  async findByIdInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryAdjustmentRecord | null> {
    const record = await this.tx.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: journalEntryItemInclude
    });

    return record ? mapAdjustmentRecord(record) : null;
  }

  async updateStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string,
    expectedStatuses: JournalEntryAdjustmentRecord['status'][],
    nextStatus: JournalEntryAdjustmentRecord['status']
  ): Promise<number> {
    const claimed = await this.tx.journalEntry.updateMany({
      where: {
        id: journalEntryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: expectedStatuses
        }
      },
      data: {
        status: nextStatus
      }
    });

    return claimed.count;
  }

  async findCurrentStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryAdjustmentRecord['status'] | null> {
    const currentJournalEntry = await this.tx.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        status: true
      }
    });

    return currentJournalEntry?.status ?? null;
  }

  async updateCollectedTransactionStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    expectedStatuses: CollectedTransactionStatusValue[],
    nextStatus: CollectedTransactionStatusValue
  ): Promise<number> {
    const claimed = await this.tx.collectedTransaction.updateMany({
      where: {
        id: collectedTransactionId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: expectedStatuses
        }
      },
      data: {
        status: nextStatus
      }
    });

    return claimed.count;
  }

  async findCollectedTransactionStatusInWorkspace(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatusValue | null> {
    const currentCollectedTransaction =
      await this.tx.collectedTransaction.findFirst({
        where: {
          id: collectedTransactionId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          status: true
        }
      });

    return currentCollectedTransaction?.status ?? null;
  }

  async restoreMatchedPlanningStateAfterReversal(
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    journalEntryId: string
  ): Promise<void> {
    const collectedTransaction = await this.tx.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        matchedPlanItemId: true
      }
    });

    const matchedPlanItemId = collectedTransaction?.matchedPlanItemId ?? null;
    if (!matchedPlanItemId) {
      return;
    }

    await this.tx.planItem.updateMany({
      where: {
        id: matchedPlanItemId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: PlanItemStatus.CONFIRMED
      },
      data: {
        status: PlanItemStatus.MATCHED
      }
    });

    await this.tx.liabilityRepaymentSchedule.updateMany({
      where: {
        linkedPlanItemId: matchedPlanItemId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: LiabilityRepaymentScheduleStatus.POSTED,
        postedJournalEntryId: journalEntryId
      },
      data: {
        status: LiabilityRepaymentScheduleStatus.MATCHED,
        postedJournalEntryId: null
      }
    });
  }

  async createAdjustmentEntry(input: CreateJournalEntryAdjustmentInput) {
    const record = await this.tx.journalEntry.create({
      data: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        periodId: input.periodId,
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        sourceKind: input.sourceKind,
        status: input.status,
        memo: input.memo,
        reversesJournalEntryId: input.reversesJournalEntryId ?? null,
        correctsJournalEntryId: input.correctsJournalEntryId ?? null,
        correctionReason: input.correctionReason ?? null,
        ...input.actorRef,
        lines: {
          create: input.lines
        }
      },
      include: journalEntryItemInclude
    });

    return mapJournalEntryRecordToItem(record);
  }

  async assertAdjustmentReferencesExist(
    workspace: JournalEntryWorkspaceScope,
    lines: JournalAdjustmentLineDraft[]
  ): Promise<void> {
    const activeAccountSubjects = await this.tx.accountSubject.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        isActive: true
      },
      select: {
        id: true
      }
    });

    const activeAccountSubjectIds = new Set(
      activeAccountSubjects.map((candidate) => candidate.id)
    );

    for (const line of lines) {
      if (!activeAccountSubjectIds.has(line.accountSubjectId)) {
        throw new BadRequestException(
          'One or more journal lines reference an unknown active account subject.'
        );
      }
    }

    const fundingAccountIds = [
      ...new Set(
        lines
          .map((line) => line.fundingAccountId)
          .filter((value): value is string => Boolean(value))
      )
    ];

    for (const fundingAccountId of fundingAccountIds) {
      const fundingAccount = await this.tx.account.findFirst({
        where: {
          id: fundingAccountId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      });

      if (!fundingAccount) {
        throw new BadRequestException(
          'One or more journal lines reference an unknown funding account.'
        );
      }
    }
  }
}

function mapAdjustmentRecord(
  record: JournalEntryItemRecord
): JournalEntryAdjustmentRecord {
  return {
    id: record.id,
    entryNumber: record.entryNumber,
    status: record.status,
    sourceCollectedTransaction: record.sourceCollectedTransaction
      ? {
          id: record.sourceCollectedTransaction.id,
          status: record.sourceCollectedTransaction.status
        }
      : null,
    lines: record.lines.map((line) => ({
      accountSubjectId: line.accountSubjectId,
      fundingAccountId: line.fundingAccountId,
      debitAmount: fromPrismaMoneyWon(line.debitAmount),
      creditAmount: fromPrismaMoneyWon(line.creditAmount),
      description: line.description
    }))
  };
}

function assertJournalWritePeriodClaimable(
  status: AccountingPeriodStatus
): void {
  if (
    status === AccountingPeriodStatus.OPEN ||
    status === AccountingPeriodStatus.IN_REVIEW
  ) {
    return;
  }

  throw new BadRequestException(
    '현재 운영 기간이 마감 중이거나 잠겨 있어 전표를 기록할 수 없습니다.'
  );
}
