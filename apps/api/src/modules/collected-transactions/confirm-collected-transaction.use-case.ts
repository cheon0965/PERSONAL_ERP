import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  JournalEntryItem
} from '@personal-erp/contracts';
import { JournalEntrySourceKind, JournalEntryStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { mapJournalEntryRecordToItem } from '../journal-entries/public';
import { ConfirmCollectedTransactionStorePort } from './application/ports/confirm-collected-transaction-store.port';
import { REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES } from './confirm-collected-transaction.policy';
import {
  assertConfirmationAllowed,
  assertConfirmationTransactionFound,
  assertConfirmationTransactionHasPeriod
} from './confirm-collected-transaction.validator';
import {
  buildConfirmationEntryNumber,
  buildConfirmationJournalLines,
  resolveConfirmationAccountSubjectIds
} from './confirm-collected-transaction.factory';

@Injectable()
export class ConfirmCollectedTransactionUseCase {
  constructor(
    private readonly confirmStore: ConfirmCollectedTransactionStorePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    collectedTransactionId: string
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.confirm'
    );

    const collectedTransaction =
      await this.confirmStore.findForConfirmation(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        collectedTransactionId
      );
    assertConfirmationTransactionFound(collectedTransaction);
    assertConfirmationTransactionHasPeriod(collectedTransaction);

    const period = collectedTransaction.period;
    assertConfirmationAllowed({
      status: collectedTransaction.status,
      periodStatus: period.status,
      postedJournalEntryId: collectedTransaction.postedJournalEntry?.id ?? null
    });

    const accountSubjects =
      await this.confirmStore.findActiveAccountSubjects(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES
      );
    const accountSubjectIds =
      resolveConfirmationAccountSubjectIds(accountSubjects);

    const journalEntry = await this.confirmStore.runInTransaction(
      async (ctx) => {
        const latestCollectedTransaction =
          await ctx.findLatestForConfirmation(
            {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            collectedTransaction.id
          );
        assertConfirmationTransactionFound(latestCollectedTransaction);
        assertConfirmationTransactionHasPeriod(latestCollectedTransaction);

        const latestPeriod = latestCollectedTransaction.period;
        assertConfirmationAllowed({
          status: latestCollectedTransaction.status,
          periodStatus: latestPeriod.status,
          postedJournalEntryId:
            latestCollectedTransaction.postedJournalEntry?.id ?? null
        });

        const allocatedEntryNumber =
          await ctx.allocateJournalEntryNumber(
            {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            latestPeriod.id
          );

        const journalLines = buildConfirmationJournalLines({
          collectedTransaction: latestCollectedTransaction,
          accountSubjectIds
        });

        const claimedCollectedTransaction =
          await ctx.claimForConfirmation({
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            collectedTransactionId: latestCollectedTransaction.id,
            currentStatus: latestCollectedTransaction.status
          });

        await ctx.assertClaimSucceeded({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          collectedTransactionId: collectedTransaction.id,
          updatedCount: claimedCollectedTransaction.count
        });

        const entryNumber = buildConfirmationEntryNumber({
          year: allocatedEntryNumber.period.year,
          month: allocatedEntryNumber.period.month,
          sequence: allocatedEntryNumber.sequence
        });

        const created = await ctx.createJournalEntry({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: allocatedEntryNumber.period.id,
          entryNumber,
          entryDate: latestCollectedTransaction.occurredOn,
          sourceKind: JournalEntrySourceKind.COLLECTED_TRANSACTION,
          sourceCollectedTransactionId: latestCollectedTransaction.id,
          status: JournalEntryStatus.POSTED,
          memo:
            latestCollectedTransaction.memo ??
            latestCollectedTransaction.title,
          ...createdByActorRef,
          lines: journalLines
        });

        await ctx.markMatchedPlanItemConfirmed(
          latestCollectedTransaction.matchedPlanItemId
        );

        return created;
      }
    );

    return mapJournalEntryRecordToItem(journalEntry);
  }
}
