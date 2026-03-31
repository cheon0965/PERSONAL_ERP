import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus
} from '@prisma/client';

const allowedCollectedTransactionTransitions = new Map<
  CollectedTransactionStatus,
  readonly CollectedTransactionStatus[]
>([
  [
    CollectedTransactionStatus.COLLECTED,
    [
      CollectedTransactionStatus.REVIEWED,
      CollectedTransactionStatus.READY_TO_POST,
      CollectedTransactionStatus.POSTED,
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [
    CollectedTransactionStatus.REVIEWED,
    [
      CollectedTransactionStatus.READY_TO_POST,
      CollectedTransactionStatus.POSTED,
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [
    CollectedTransactionStatus.READY_TO_POST,
    [
      CollectedTransactionStatus.POSTED,
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [
    CollectedTransactionStatus.POSTED,
    [
      CollectedTransactionStatus.CORRECTED,
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [CollectedTransactionStatus.CORRECTED, [CollectedTransactionStatus.LOCKED]],
  [CollectedTransactionStatus.LOCKED, []]
]);

export function assertCollectedTransactionCanBeConfirmed(input: {
  status: CollectedTransactionStatus;
  periodStatus: AccountingPeriodStatus;
  postedJournalEntryId: string | null;
}): void {
  if (input.periodStatus === AccountingPeriodStatus.LOCKED) {
    throw new BadRequestException(
      'Collected transaction in a locked period cannot be confirmed.'
    );
  }

  if (input.postedJournalEntryId) {
    throw new ConflictException('Collected transaction is already posted.');
  }

  assertCollectedTransactionStatusTransition(
    input.status,
    CollectedTransactionStatus.POSTED,
    'Collected transaction in current status cannot be confirmed.'
  );
}

export function assertCollectedTransactionCanBeCorrected(
  currentStatus: CollectedTransactionStatus
): void {
  assertCollectedTransactionStatusTransition(
    currentStatus,
    CollectedTransactionStatus.CORRECTED,
    'Only posted collected transactions can be corrected.'
  );
}

function assertCollectedTransactionStatusTransition(
  fromStatus: CollectedTransactionStatus,
  toStatus: CollectedTransactionStatus,
  message: string
): void {
  const allowedTransitions = allowedCollectedTransactionTransitions.get(fromStatus);
  if (allowedTransitions?.includes(toStatus)) {
    return;
  }

  throw new ConflictException(message);
}
