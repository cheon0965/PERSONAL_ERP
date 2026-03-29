import type { CollectedTransactionItem } from '@personal-erp/contracts';
import type {
  CollectedTransactionStorePort,
  CollectedTransactionWorkspaceScope
} from '../ports/collected-transaction-store.port';
import { mapCollectedTransactionToItem } from '../collected-transaction-item.mapper';

export class ListCollectedTransactionsUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort
  ) {}

  async execute(
    workspace: CollectedTransactionWorkspaceScope
  ): Promise<CollectedTransactionItem[]> {
    const transactions =
      await this.collectedTransactionStore.findRecentInWorkspace(workspace);
    return transactions.map(mapCollectedTransactionToItem);
  }
}
