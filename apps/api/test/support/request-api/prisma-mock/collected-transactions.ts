import { createCollectedTransactionReadMethods } from './collected-transaction-read';
import { createCollectedTransactionWriteMethods } from './collected-transaction-write';
import type { RequestPrismaMockContext } from './shared';

export function createCollectedTransactionsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    collectedTransaction: {
      ...createCollectedTransactionReadMethods(context),
      ...createCollectedTransactionWriteMethods(context)
    }
  };
}
