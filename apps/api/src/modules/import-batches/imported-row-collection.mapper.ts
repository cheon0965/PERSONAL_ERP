import type {
  CollectImportedRowRequest,
  CollectedTransactionItem
} from '@personal-erp/contracts';
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
    amountWon: transaction.amount,
    fundingAccountName: transaction.fundingAccount.name,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: 'PENDING',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  };
}
