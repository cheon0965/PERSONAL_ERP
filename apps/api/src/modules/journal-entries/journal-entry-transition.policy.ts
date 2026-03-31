import { ConflictException } from '@nestjs/common';
import { JournalEntryStatus } from '@prisma/client';

const allowedJournalEntryTransitions = new Map<
  JournalEntryStatus,
  readonly JournalEntryStatus[]
>([
  [
    JournalEntryStatus.POSTED,
    [JournalEntryStatus.REVERSED, JournalEntryStatus.SUPERSEDED]
  ],
  [JournalEntryStatus.REVERSED, []],
  [JournalEntryStatus.SUPERSEDED, []]
]);

export function assertJournalEntryCanBeReversed(
  currentStatus: JournalEntryStatus
): void {
  assertJournalEntryStatusTransition(
    currentStatus,
    JournalEntryStatus.REVERSED,
    'Only posted journal entries can be reversed.'
  );
}

export function assertJournalEntryCanBeCorrected(
  currentStatus: JournalEntryStatus
): void {
  assertJournalEntryStatusTransition(
    currentStatus,
    JournalEntryStatus.SUPERSEDED,
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

  throw new ConflictException(message);
}
