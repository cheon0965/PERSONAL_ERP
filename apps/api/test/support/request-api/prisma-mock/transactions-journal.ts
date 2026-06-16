import { createCollectedTransactionsPrismaMock } from './collected-transactions';
import { createJournalEntriesPrismaMock } from './journal-entries';
import type { RequestPrismaMockContext } from './shared';

export function createTransactionsJournalPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createCollectedTransactionsPrismaMock(context),
    ...createJournalEntriesPrismaMock(context)
  };
}
