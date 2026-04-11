import type {
  CollectImportedRowRequest,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import type { CreatedCollectedTransactionRecord } from './imported-row-collection.types';

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
    fundingAccountName: transaction.fundingAccount.name,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: transaction.status,
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: transaction.matchedPlanItem?.id ?? null,
    matchedPlanItemTitle: transaction.matchedPlanItem?.title ?? null
  };
}
