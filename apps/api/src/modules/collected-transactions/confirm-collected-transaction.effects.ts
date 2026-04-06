import { ConflictException } from '@nestjs/common';
import {
  CollectedTransactionStatus,
  PlanItemStatus,
  type Prisma
} from '@prisma/client';
import {
  assertConfirmationAllowed,
  assertConfirmationTransactionFound,
  assertConfirmationTransactionHasPeriod
} from './confirm-collected-transaction.validator';
import { readCurrentCollectedTransactionForConfirmation } from './confirm-collected-transaction.reader';

export async function claimCollectedTransactionForConfirmation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    currentStatus: CollectedTransactionStatus;
  }
) {
  return tx.collectedTransaction.updateMany({
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
}

export async function assertConfirmationClaimSucceeded(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    updatedCount: number;
  }
) {
  if (input.updatedCount === 1) {
    return;
  }

  const currentCollectedTransaction =
    await readCurrentCollectedTransactionForConfirmation(
      tx,
      {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      },
      input.collectedTransactionId
    );

  assertConfirmationTransactionFound(currentCollectedTransaction);
  assertConfirmationTransactionHasPeriod(currentCollectedTransaction);
  assertConfirmationAllowed({
    status: currentCollectedTransaction.status,
    periodStatus: currentCollectedTransaction.period.status,
    postedJournalEntryId:
      currentCollectedTransaction.postedJournalEntry?.id ?? null
  });

  throw new ConflictException(
    'Collected transaction changed during confirmation. Please retry.'
  );
}

export async function markMatchedPlanItemConfirmed(
  tx: Prisma.TransactionClient,
  matchedPlanItemId: string | null | undefined
) {
  if (!matchedPlanItemId) {
    return;
  }

  await tx.planItem.update({
    where: {
      id: matchedPlanItemId
    },
    data: {
      status: PlanItemStatus.CONFIRMED
    }
  });
}
