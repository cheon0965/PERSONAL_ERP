import { createCollectedTransactionReadMethods } from './request-api.test-prisma-mock-collected-transaction-read';
import { createCollectedTransactionWriteMethods } from './request-api.test-prisma-mock-collected-transaction-write';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

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
