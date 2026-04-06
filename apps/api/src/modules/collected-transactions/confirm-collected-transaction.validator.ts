import { BadRequestException, NotFoundException } from '@nestjs/common';
import { assertCollectedTransactionCanBeConfirmed } from './collected-transaction-transition.policy';

export function assertConfirmationTransactionFound<T>(
  transaction: T | null
): asserts transaction is T {
  if (!transaction) {
    throw new NotFoundException('Collected transaction not found.');
  }
}

export function assertConfirmationTransactionHasPeriod<
  T extends {
    period: {
      status: unknown;
    } | null;
  }
>(
  transaction: T
): asserts transaction is T & { period: NonNullable<T['period']> } {
  if (!transaction.period) {
    throw new BadRequestException(
      'Collected transaction is not linked to an accounting period.'
    );
  }
}

export function assertConfirmationAllowed(input: {
  status: Parameters<
    typeof assertCollectedTransactionCanBeConfirmed
  >[0]['status'];
  periodStatus: Parameters<
    typeof assertCollectedTransactionCanBeConfirmed
  >[0]['periodStatus'];
  postedJournalEntryId: string | null;
}) {
  assertCollectedTransactionCanBeConfirmed(input);
}
