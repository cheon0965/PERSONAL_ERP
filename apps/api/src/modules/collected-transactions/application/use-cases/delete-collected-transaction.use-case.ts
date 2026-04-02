import { assertCollectedTransactionCanBeDeleted } from '../../collected-transaction-transition.policy';
import type {
  CollectedTransactionStorePort,
  CollectedTransactionWorkspaceScope
} from '../ports/collected-transaction-store.port';

export class DeleteCollectedTransactionUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort
  ) {}

  async execute(
    workspace: CollectedTransactionWorkspaceScope,
    collectedTransactionId: string
  ): Promise<boolean> {
    const existing = await this.collectedTransactionStore.findByIdInWorkspace(
      workspace,
      collectedTransactionId
    );

    if (!existing) {
      return false;
    }

    assertCollectedTransactionCanBeDeleted({
      postingStatus: existing.status,
      postedJournalEntryId: existing.postedJournalEntryId
    });

    return this.collectedTransactionStore.deleteInWorkspace(
      workspace,
      collectedTransactionId
    );
  }
}