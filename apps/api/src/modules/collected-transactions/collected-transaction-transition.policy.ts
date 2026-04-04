import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CollectedTransactionPostingStatus } from '@personal-erp/contracts';
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
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [
    CollectedTransactionStatus.REVIEWED,
    [
      CollectedTransactionStatus.READY_TO_POST,
      CollectedTransactionStatus.LOCKED
    ]
  ],
  [
    CollectedTransactionStatus.READY_TO_POST,
    [CollectedTransactionStatus.POSTED, CollectedTransactionStatus.LOCKED]
  ],
  [
    CollectedTransactionStatus.POSTED,
    [CollectedTransactionStatus.CORRECTED, CollectedTransactionStatus.LOCKED]
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

export function assertCollectedTransactionCanBeUpdated(input: {
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
}): void {
  assertPendingCollectedTransactionMutationAllowed(
    input,
    'Only unposted collected transactions can be updated.'
  );
}

export function assertCollectedTransactionCanBeDeleted(input: {
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
}): void {
  assertPendingCollectedTransactionMutationAllowed(
    input,
    'Only unposted collected transactions can be deleted.'
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

function assertPendingCollectedTransactionMutationAllowed(
  input: {
    postingStatus: CollectedTransactionPostingStatus;
    postedJournalEntryId: string | null;
  },
  message: string
): void {
  if (input.postedJournalEntryId) {
    throw new ConflictException(
      'Posted collected transactions must be adjusted through journal entries.'
    );
  }

  if (!isUnpostedCollectedTransactionPostingStatus(input.postingStatus)) {
    throw new ConflictException(message);
  }
}

function isUnpostedCollectedTransactionPostingStatus(
  status: CollectedTransactionPostingStatus
): status is 'COLLECTED' | 'REVIEWED' | 'READY_TO_POST' {
  return (
    status === 'COLLECTED' ||
    status === 'REVIEWED' ||
    status === 'READY_TO_POST'
  );
}

function assertCollectedTransactionStatusTransition(
  fromStatus: CollectedTransactionStatus,
  toStatus: CollectedTransactionStatus,
  message: string
): void {
  const allowedTransitions =
    allowedCollectedTransactionTransitions.get(fromStatus);
  if (allowedTransitions?.includes(toStatus)) {
    return;
  }

  throw new ConflictException(message);
}
