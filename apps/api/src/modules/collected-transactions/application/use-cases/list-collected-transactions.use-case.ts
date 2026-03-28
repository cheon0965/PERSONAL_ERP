import type { CollectedTransactionItem } from '@personal-erp/contracts';
import type { CollectedTransactionStorePort } from '../ports/collected-transaction-store.port';
import { mapCollectedTransactionToItem } from '../collected-transaction-item.mapper';

export class ListCollectedTransactionsUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort
  ) {}

  async execute(userId: string): Promise<CollectedTransactionItem[]> {
    const transactions =
      await this.collectedTransactionStore.findRecentByUserId(userId);
    return transactions.map(mapCollectedTransactionToItem);
  }
}
