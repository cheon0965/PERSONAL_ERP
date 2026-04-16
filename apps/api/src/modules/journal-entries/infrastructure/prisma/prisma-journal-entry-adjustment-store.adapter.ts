import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CollectedTransactionStatus,
  JournalEntryStatus,
  Prisma
} from '@prisma/client';
import {
  type CreateJournalEntryAdjustmentInput,
  JournalEntryAdjustmentStorePort,
  type JournalEntryWorkspaceScope
} from '../../application/ports/journal-entry-adjustment-store.port';
import type { JournalAdjustmentLineDraft } from '../../journal-entry-adjustment.policy';
import {
  journalEntryItemInclude,
  type JournalEntryItemRecord
} from '../../journal-entry.record';

@Injectable()
export class PrismaJournalEntryAdjustmentStoreAdapter extends JournalEntryAdjustmentStorePort {
  async findByIdInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryItemRecord | null> {
    return tx.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: journalEntryItemInclude
    });
  }

  async updateStatusInWorkspace(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string,
    expectedStatuses: JournalEntryStatus[],
    nextStatus: JournalEntryStatus
  ): Promise<number> {
    const claimed = await tx.journalEntry.updateMany({
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
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null> {
    const currentJournalEntry = await tx.journalEntry.findFirst({
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
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string,
    expectedStatuses: CollectedTransactionStatus[],
    nextStatus: CollectedTransactionStatus
  ): Promise<number> {
    const claimed = await tx.collectedTransaction.updateMany({
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
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatus | null> {
    const currentCollectedTransaction = await tx.collectedTransaction.findFirst(
      {
        where: {
          id: collectedTransactionId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: {
          status: true
        }
      }
    );

    return currentCollectedTransaction?.status ?? null;
  }

  async createAdjustmentEntry(
    tx: Prisma.TransactionClient,
    input: CreateJournalEntryAdjustmentInput
  ): Promise<JournalEntryItemRecord> {
    return tx.journalEntry.create({
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
  }

  async assertAdjustmentReferencesExist(
    tx: Prisma.TransactionClient,
    workspace: JournalEntryWorkspaceScope,
    lines: JournalAdjustmentLineDraft[]
  ): Promise<void> {
    const activeAccountSubjects = await tx.accountSubject.findMany({
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

    if (fundingAccountIds.length === 0) {
      return;
    }

    for (const fundingAccountId of fundingAccountIds) {
      const fundingAccount = await tx.account.findFirst({
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
