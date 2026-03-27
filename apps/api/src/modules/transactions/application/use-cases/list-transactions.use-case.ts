import type { TransactionItem } from '@personal-erp/contracts';
import type { TransactionStorePort } from '../ports/transaction-store.port';
import { mapTransactionToItem } from '../transaction-item.mapper';

export class ListTransactionsUseCase {
  constructor(private readonly transactionStore: TransactionStorePort) {}

  async execute(userId: string): Promise<TransactionItem[]> {
    const transactions = await this.transactionStore.findRecentByUserId(userId);
    return transactions.map(mapTransactionToItem);
  }
}
