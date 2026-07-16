import type {
  CollectImportedRowRequest,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { fromPrismaMoneyWon } from '../../../../common/money/prisma-money';
import type { CreatedCollectedTransactionRecord } from '../models/imported-row-collection.types';

export function mapCreatedCollectedTransactionToItem(
  transaction: CreatedCollectedTransactionRecord,
  type: CollectImportedRowRequest['type']
): CollectedTransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.occurredOn.toISOString().slice(0, 10),
    title: transaction.title,
    type,
    amountWon: fromPrismaMoneyWon(transaction.amount),
    ledgerTransactionTypeId: transaction.ledgerTransactionTypeId,
    ledgerTransactionTypeName: transaction.ledgerTransactionType.name,
    postingPolicyKey: transaction.ledgerTransactionType.postingPolicyKey,
    fundingAccountDirection: transaction.fundingAccountDirection,
    fundingAccountName: transaction.fundingAccount.name,
    counterpartyFundingAccountId: transaction.counterpartyFundingAccountId,
    counterpartyFundingAccountName:
      transaction.counterpartyFundingAccount?.name ?? null,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: transaction.status,
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: transaction.matchedPlanItem?.id ?? null,
    matchedPlanItemTitle: transaction.matchedPlanItem?.title ?? null
  };
}
