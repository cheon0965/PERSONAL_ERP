import { conflictError } from '../../../common/application/errors/app-error';

type JournalEntryStatus = 'POSTED' | 'REVERSED' | 'SUPERSEDED';

const allowedJournalEntryTransitions = new Map<
  JournalEntryStatus,
  readonly JournalEntryStatus[]
>([
  ['POSTED', ['REVERSED', 'SUPERSEDED']],
  ['REVERSED', []],
  ['SUPERSEDED', []]
]);

export function assertJournalEntryCanBeReversed(
  currentStatus: JournalEntryStatus
): void {
  assertJournalEntryStatusTransition(
    currentStatus,
    'REVERSED',
    'Only posted journal entries can be reversed.'
  );
}

export function assertJournalEntryCanBeCorrected(
  currentStatus: JournalEntryStatus
): void {
  assertJournalEntryStatusTransition(
    currentStatus,
    'SUPERSEDED',
    'Only posted journal entries can be corrected.'
  );
}

function assertJournalEntryStatusTransition(
  fromStatus: JournalEntryStatus,
  toStatus: JournalEntryStatus,
  message: string
): void {
  const allowedTransitions = allowedJournalEntryTransitions.get(fromStatus);
  if (allowedTransitions?.includes(toStatus)) {
    return;
  }

  throw conflictError(message);
}
