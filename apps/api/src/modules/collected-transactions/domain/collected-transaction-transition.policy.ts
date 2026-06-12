import {
  conflictError,
  validationError
} from '../../../common/application/errors/app-error';

type AccountingPeriodStatus = 'OPEN' | 'IN_REVIEW' | 'CLOSING' | 'LOCKED';
type CollectedTransactionStatus =
  | 'COLLECTED'
  | 'REVIEWED'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'CORRECTED'
  | 'LOCKED';
type CollectedTransactionPostingStatus = CollectedTransactionStatus;

const allowedCollectedTransactionTransitions = new Map<
  CollectedTransactionStatus,
  readonly CollectedTransactionStatus[]
>([
  ['COLLECTED', ['REVIEWED', 'READY_TO_POST', 'LOCKED']],
  ['REVIEWED', ['READY_TO_POST', 'LOCKED']],
  ['READY_TO_POST', ['POSTED', 'LOCKED']],
  ['POSTED', ['CORRECTED', 'LOCKED']],
  ['CORRECTED', ['LOCKED']],
  ['LOCKED', []]
]);

export function assertCollectedTransactionCanBeConfirmed(input: {
  status: CollectedTransactionStatus;
  periodStatus: AccountingPeriodStatus;
  postedJournalEntryId: string | null;
}): void {
  if (input.periodStatus === 'LOCKED') {
    throw validationError(
      'Collected transaction in a locked period cannot be confirmed.'
    );
  }

  if (input.postedJournalEntryId) {
    throw conflictError('Collected transaction is already posted.');
  }

  assertCollectedTransactionStatusTransition(
    input.status,
    'POSTED',
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
    'CORRECTED',
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
    throw conflictError(
      'Posted collected transactions must be adjusted through journal entries.'
    );
  }

  if (!isUnpostedCollectedTransactionPostingStatus(input.postingStatus)) {
    throw conflictError(message);
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

  throw conflictError(message);
}
