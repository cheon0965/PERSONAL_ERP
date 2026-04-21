import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
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
import { readParsedImportedRowPayload } from '../import-batches/import-batch.policy';
import { mapJournalEntryRecordToItem } from '../journal-entries/public';
import {
  assertBalancedJournalAdjustmentLines,
  buildReversalJournalLines
} from '../journal-entries/journal-entry-adjustment.policy';
import { assertJournalEntryCanBeReversed } from '../journal-entries/journal-entry-transition.policy';
import { assertCollectedTransactionCanBeCorrected } from './public';
import {
  ConfirmCollectedTransactionStorePort,
  type ConfirmationCollectedTransaction,
  type ConfirmTransactionContext
} from './application/ports/confirm-collected-transaction-store.port';
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

    const supportsImportedReversal = isImportedReversalTransaction(
      collectedTransaction
    );
    const accountSubjectIds = supportsImportedReversal
      ? null
      : resolveConfirmationAccountSubjectIds(
          await this.confirmStore.findActiveAccountSubjects(
            {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES
          )
        );

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

        if (isImportedReversalTransaction(latestCollectedTransaction)) {
          return this.confirmImportedReversalTransaction({
            ctx,
            workspace: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            collectedTransaction: latestCollectedTransaction,
            periodId: allocatedEntryNumber.period.id,
            entryNumber,
            createdByActorRef
          });
        }

        const journalLines = buildConfirmationJournalLines({
          collectedTransaction: latestCollectedTransaction,
          accountSubjectIds: accountSubjectIds!
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

  private async confirmImportedReversalTransaction(input: {
    ctx: ConfirmTransactionContext;
    workspace: {
      tenantId: string;
      ledgerId: string;
    };
    collectedTransaction: ConfirmationCollectedTransaction;
    periodId: string;
    entryNumber: string;
    createdByActorRef: ReturnType<typeof readWorkspaceCreatedByActorRef>;
  }) {
    const reversalTargetRowNumber = readImportedReversalTargetRowNumber(
      input.collectedTransaction.importedRow?.rawPayload
    );

    if (
      reversalTargetRowNumber == null ||
      input.collectedTransaction.importedRow == null
    ) {
      throw new BadRequestException(
        '승인취소 업로드 행의 원거래 후보 정보를 읽을 수 없습니다.'
      );
    }

    const target = await input.ctx.findReversalTarget(
      input.workspace,
      input.collectedTransaction.importedRow.batchId,
      reversalTargetRowNumber
    );

    if (!target?.createdCollectedTransaction) {
      throw new BadRequestException(
        '승인취소 대상 원거래를 먼저 수집 거래로 등록해 주세요.'
      );
    }

    const originalCollectedTransaction = target.createdCollectedTransaction;
    const originalJournalEntry =
      originalCollectedTransaction.postedJournalEntry ?? null;

    if (!originalJournalEntry) {
      throw new BadRequestException(
        '승인취소 전표를 만들기 전에 원거래를 먼저 전표 확정해 주세요.'
      );
    }

    assertJournalEntryCanBeReversed(originalJournalEntry.status);

    const reversalLines = buildReversalJournalLines(
      originalJournalEntry.lines.map((line) => ({
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description
      }))
    );
    assertBalancedJournalAdjustmentLines(reversalLines);

    const reversedJournalEntryCount =
      await input.ctx.updateJournalEntryStatusInWorkspace({
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        journalEntryId: originalJournalEntry.id,
        expectedStatuses: [originalJournalEntry.status],
        nextStatus: JournalEntryStatus.REVERSED
      });

    if (reversedJournalEntryCount !== 1) {
      const currentJournalEntryStatus =
        await input.ctx.findCurrentJournalEntryStatusInWorkspace(
          input.workspace,
          originalJournalEntry.id
        );

      if (!currentJournalEntryStatus) {
        throw new NotFoundException('Original journal entry not found.');
      }

      assertJournalEntryCanBeReversed(currentJournalEntryStatus);

      throw new ConflictException(
        'Original journal entry changed during reversal confirmation. Please retry.'
      );
    }

    const correctedCollectedTransactionCount =
      await input.ctx.updateCollectedTransactionStatusInWorkspace({
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        collectedTransactionId: originalCollectedTransaction.id,
        expectedStatuses: [originalCollectedTransaction.status],
        nextStatus: CollectedTransactionStatus.CORRECTED
      });

    if (correctedCollectedTransactionCount !== 1) {
      const currentCollectedTransactionStatus =
        await input.ctx.findCurrentCollectedTransactionStatusInWorkspace(
          input.workspace,
          originalCollectedTransaction.id
        );

      if (!currentCollectedTransactionStatus) {
        throw new NotFoundException('Original collected transaction not found.');
      }

      assertCollectedTransactionCanBeCorrected(
        currentCollectedTransactionStatus
      );

      throw new ConflictException(
        'Original collected transaction changed during reversal confirmation. Please retry.'
      );
    }

    return input.ctx.createJournalEntry({
      tenantId: input.workspace.tenantId,
      ledgerId: input.workspace.ledgerId,
      periodId: input.periodId,
      entryNumber: input.entryNumber,
      entryDate: input.collectedTransaction.occurredOn,
      sourceKind: JournalEntrySourceKind.MANUAL_ADJUSTMENT,
      sourceCollectedTransactionId: input.collectedTransaction.id,
      status: JournalEntryStatus.POSTED,
      memo:
        input.collectedTransaction.memo ??
        `${input.collectedTransaction.title} 승인취소`,
      reversesJournalEntryId: originalJournalEntry.id,
      ...input.createdByActorRef,
      lines: reversalLines
    });
  }
}

function isImportedReversalTransaction(
  collectedTransaction: ConfirmationCollectedTransaction
): boolean {
  return (
    collectedTransaction.ledgerTransactionType.postingPolicyKey ===
      'MANUAL_ADJUSTMENT' && collectedTransaction.importedRow != null
  );
}

function readImportedReversalTargetRowNumber(rawPayload: unknown): number | null {
  const parsed = readParsedImportedRowPayload(rawPayload as never);

  return parsed?.collectTypeHint === 'REVERSAL' &&
    Number.isInteger(parsed.reversalTargetRowNumber)
    ? parsed.reversalTargetRowNumber ?? null
    : null;
}
