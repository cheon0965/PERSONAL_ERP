import type { TransactionItem } from '@personal-erp/contracts';
import type { StoredTransaction } from './ports/transaction-store.port';

export function mapTransactionToItem(
  transaction: StoredTransaction
): TransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.businessDate.toISOString().slice(0, 10),
    title: transaction.title,
    type: transaction.type,
    amountWon: transaction.amountWon,
    accountName: transaction.account.name,
    categoryName: transaction.category?.name ?? '-',
    origin: transaction.origin,
    status: transaction.status
  };
}
