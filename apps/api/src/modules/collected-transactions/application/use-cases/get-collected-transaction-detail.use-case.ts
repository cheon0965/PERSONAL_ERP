import type { CollectedTransactionDetailItem } from '@personal-erp/contracts';
import { mapCollectedTransactionToDetailItem } from '../collected-transaction-item.mapper';
import type {
  CollectedTransactionStorePort,
  CollectedTransactionWorkspaceScope
} from '../ports/collected-transaction-store.port';

export class GetCollectedTransactionDetailUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort
  ) {}

  async execute(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionDetailItem | null> {
    const transaction =
      await this.collectedTransactionStore.findByIdInWorkspace(
        workspace,
        collectedTransactionId
      );

    return transaction
      ? mapCollectedTransactionToDetailItem(transaction)
      : null;
  }
}
