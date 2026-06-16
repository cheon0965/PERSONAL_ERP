import { createAccountSubjectsPrismaMock } from './account-subjects';
import { createCategoriesPrismaMock } from './categories';
import { createFundingAccountsPrismaMock } from './funding-accounts';
import { createLedgerTransactionTypesPrismaMock } from './ledger-transaction-types';
import type { RequestPrismaMockContext } from './shared';

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
