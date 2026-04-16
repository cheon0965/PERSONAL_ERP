import type {
  CollectedTransactionItem,
  UpdateCollectedTransactionRequest
} from '@personal-erp/contracts';
import {
  MissingOwnedCollectedTransactionReferenceError,
  resolveMissingOwnedCollectedTransactionReference
} from '../../domain/collected-transaction-policy';
import { assertCollectedTransactionCanBeUpdated } from '../../collected-transaction-transition.policy';
import { mapCollectedTransactionToItem } from '../collected-transaction-item.mapper';
import type { ReferenceOwnershipPort } from '../ports/reference-ownership.port';
import type { CollectedTransactionStorePort } from '../ports/collected-transaction-store.port';

type UpdateCollectedTransactionCommand = UpdateCollectedTransactionRequest & {
  collectedTransactionId: string;
  tenantId: string;
  ledgerId: string;
  periodId: string;
};

export class UpdateCollectedTransactionUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort,
    private readonly referenceOwnership: ReferenceOwnershipPort
  ) {}

  async execute(
    command: UpdateCollectedTransactionCommand
  ): Promise<CollectedTransactionItem | null> {
    const existing = await this.collectedTransactionStore.findByIdInWorkspace(
      {
        tenantId: command.tenantId,
        ledgerId: command.ledgerId
      },
      command.collectedTransactionId
    );

    if (!existing) {
      return null;
    }

    assertCollectedTransactionCanBeUpdated({
      postingStatus: existing.status,
      postedJournalEntryId: existing.postedJournalEntryId
    });

    const [fundingAccountExists, categoryExists] = await Promise.all([
      this.referenceOwnership.fundingAccountExistsInWorkspace(
        command.tenantId,
        command.ledgerId,
        command.fundingAccountId
      ),
      this.referenceOwnership.categoryExistsInWorkspace(
        command.tenantId,
        command.ledgerId,
        command.categoryId
      )
    ]);

    const missingReference = resolveMissingOwnedCollectedTransactionReference({
      fundingAccountExists,
      categoryExists
    });

    if (missingReference) {
      throw new MissingOwnedCollectedTransactionReferenceError(
        missingReference
      );
    }

    const updated = await this.collectedTransactionStore.updateInWorkspace(
      {
        tenantId: command.tenantId,
        ledgerId: command.ledgerId
      },
      {
        id: command.collectedTransactionId,
        periodId: command.periodId,
        title: command.title,
        type: command.type,
        amountWon: command.amountWon,
        businessDate: new Date(command.businessDate),
        fundingAccountId: command.fundingAccountId,
        categoryId: command.categoryId,
        memo: command.memo
      }
    );

    return mapCollectedTransactionToItem(updated);
  }
}
