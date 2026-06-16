import {
  notFoundError,
  validationError
} from '../../../../common/application/errors/app-error';
import { assertCollectedTransactionCanBeConfirmed } from '../../domain/collected-transaction-transition.policy';

export function assertConfirmationTransactionFound<T>(
  transaction: T | null
): asserts transaction is T {
  if (!transaction) {
    throw notFoundError('Collected transaction not found.');
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
    throw validationError(
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
