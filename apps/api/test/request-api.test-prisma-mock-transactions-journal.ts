import { createCollectedTransactionsPrismaMock } from './request-api.test-prisma-mock-collected-transactions';
import { createJournalEntriesPrismaMock } from './request-api.test-prisma-mock-journal-entries';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createTransactionsJournalPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createCollectedTransactionsPrismaMock(context),
    ...createJournalEntriesPrismaMock(context)
  };
}
