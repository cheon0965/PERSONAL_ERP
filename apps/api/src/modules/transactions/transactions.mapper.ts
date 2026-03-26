import type { TransactionItem } from '@personal-erp/contracts';

type TransactionRecord = {
  id: string;
  businessDate: Date;
  title: string;
  type: TransactionItem['type'];
  amountWon: number;
  origin: TransactionItem['origin'];
  status: TransactionItem['status'];
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
};

export function mapTransactionToItem(transaction: TransactionRecord): TransactionItem {
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
