import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CorrectJournalEntryRequest,
  JournalEntryItem
} from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import { assertCollectedTransactionCanBeCorrected } from '../collected-transactions/public';
import { JournalEntryAdjustmentStorePort } from './application/ports/journal-entry-adjustment-store.port';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  normalizeJournalAdjustmentLines,
  normalizeOptionalText
} from './journal-entry-adjustment.policy';
import { assertJournalEntryCanBeCorrected } from './journal-entry-transition.policy';

@Injectable()
export class CorrectJournalEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort,
    private readonly journalEntryAdjustmentStore: JournalEntryAdjustmentStorePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    journalEntryId: string,
    input: CorrectJournalEntryRequest
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const workspaceScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'journal_entry.correct'
    );

    const reason = normalizeOptionalText(input.reason);
    if (!reason) {
      throw new BadRequestException('Correction reason is required.');
    }

    const normalizedLines = normalizeJournalAdjustmentLines(input.lines);

    try {
      assertBalancedJournalAdjustmentLines(normalizedLines);
    } catch (error) {
      throw new BadRequestException(readAdjustmentErrorMessage(error));
    }

    const targetPeriod =
      await this.accountingPeriodWriteGuard.assertJournalEntryDateAllowed(
        workspaceScope,
        input.entryDate
      );

    const createdJournalEntry = await this.prisma.$transaction(async (tx) => {
      const allocatedEntryNumber =
        await this.accountingPeriodWriteGuard.allocateJournalEntryNumberInTransaction(
          tx,
          workspaceScope,
          targetPeriod.id
        );

      const originalJournalEntry =
        await this.journalEntryAdjustmentStore.findByIdInWorkspace(
          tx,
          workspaceScope,
          journalEntryId
        );

      if (!originalJournalEntry) {
        throw new NotFoundException('Journal entry not found.');
      }

      assertJournalEntryCanBeCorrected(originalJournalEntry.status);

      await this.journalEntryAdjustmentStore.assertAdjustmentReferencesExist(
        tx,
        workspaceScope,
        normalizedLines
      );

      const claimedOriginalJournalEntryCount =
        await this.journalEntryAdjustmentStore.updateStatusInWorkspace(
          tx,
          workspaceScope,
          originalJournalEntry.id,
          [originalJournalEntry.status],
          JournalEntryStatus.SUPERSEDED
        );

      if (claimedOriginalJournalEntryCount !== 1) {
        const currentJournalEntryStatus =
          await this.journalEntryAdjustmentStore.findCurrentStatusInWorkspace(
            tx,
            workspaceScope,
            journalEntryId
          );

        if (!currentJournalEntryStatus) {
          throw new NotFoundException('Journal entry not found.');
        }

        assertJournalEntryCanBeCorrected(currentJournalEntryStatus);

        throw new ConflictException(
          'Journal entry changed during correction. Please retry.'
        );
      }

      if (originalJournalEntry.sourceCollectedTransaction) {
        const claimedCollectedTransactionCount =
          await this.journalEntryAdjustmentStore.updateCollectedTransactionStatusInWorkspace(
            tx,
            workspaceScope,
            originalJournalEntry.sourceCollectedTransaction.id,
            [originalJournalEntry.sourceCollectedTransaction.status],
            CollectedTransactionStatus.CORRECTED
          );

        if (claimedCollectedTransactionCount !== 1) {
          const currentCollectedTransactionStatus =
            await this.journalEntryAdjustmentStore.findCollectedTransactionStatusInWorkspace(
              tx,
              workspaceScope,
              originalJournalEntry.sourceCollectedTransaction.id
            );

          if (!currentCollectedTransactionStatus) {
            throw new NotFoundException('Collected transaction not found.');
          }

          assertCollectedTransactionCanBeCorrected(
            currentCollectedTransactionStatus
          );

          throw new ConflictException(
            'Collected transaction changed during correction. Please retry.'
          );
        }
      }

      return this.journalEntryAdjustmentStore.createAdjustmentEntry(tx, {
        workspace: workspaceScope,
        periodId: allocatedEntryNumber.period.id,
        entryNumber: buildJournalEntryEntryNumber(
          allocatedEntryNumber.period.year,
          allocatedEntryNumber.period.month,
          allocatedEntryNumber.sequence
        ),
        entryDate: buildJournalEntryDate(input.entryDate),
        sourceKind: JournalEntrySourceKind.MANUAL_ADJUSTMENT,
        status: JournalEntryStatus.POSTED,
        memo: reason,
        correctsJournalEntryId: originalJournalEntry.id,
        correctionReason: reason,
        actorRef: createdByActorRef,
        lines: normalizedLines
      });
    });

    return mapJournalEntryRecordToItem(createdJournalEntry);
  }
}

function readAdjustmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The journal adjustment is invalid.';
}
