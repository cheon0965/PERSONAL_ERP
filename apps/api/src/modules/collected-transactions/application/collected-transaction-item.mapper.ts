import type { CollectedTransactionItem } from '@personal-erp/contracts';
import type { StoredCollectedTransaction } from './ports/collected-transaction-store.port';

export function mapCollectedTransactionToItem(
  transaction: StoredCollectedTransaction
): CollectedTransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.businessDate.toISOString().slice(0, 10),
    title: transaction.title,
    type: transaction.type,
    amountWon: transaction.amountWon,
    fundingAccountName: transaction.account.name,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: transaction.origin,
    postingStatus: transaction.status
  };
}
