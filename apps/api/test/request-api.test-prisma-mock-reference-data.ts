import { createAccountSubjectsPrismaMock } from './request-api.test-prisma-mock-account-subjects';
import { createCategoriesPrismaMock } from './request-api.test-prisma-mock-categories';
import { createFundingAccountsPrismaMock } from './request-api.test-prisma-mock-funding-accounts';
import { createLedgerTransactionTypesPrismaMock } from './request-api.test-prisma-mock-ledger-transaction-types';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createReferenceDataPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createAccountSubjectsPrismaMock(context),
    ...createLedgerTransactionTypesPrismaMock(context),
    ...createFundingAccountsPrismaMock(context),
    ...createCategoriesPrismaMock(context)
  };
}
