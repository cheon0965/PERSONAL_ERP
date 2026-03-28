import type {
  CollectedTransactionItem,
  CreateCollectedTransactionRequest
} from '@personal-erp/contracts';
import {
  MissingOwnedCollectedTransactionReferenceError,
  resolveMissingOwnedCollectedTransactionReference
} from '../../domain/collected-transaction-policy';
import type { ReferenceOwnershipPort } from '../ports/reference-ownership.port';
import type { CollectedTransactionStorePort } from '../ports/collected-transaction-store.port';
import { mapCollectedTransactionToItem } from '../collected-transaction-item.mapper';

type CreateCollectedTransactionCommand = CreateCollectedTransactionRequest & {
  userId: string;
};

export class CreateCollectedTransactionUseCase {
  constructor(
    private readonly collectedTransactionStore: CollectedTransactionStorePort,
    private readonly referenceOwnership: ReferenceOwnershipPort
  ) {}

  async execute(
    command: CreateCollectedTransactionCommand
  ): Promise<CollectedTransactionItem> {
    const [fundingAccountExists, categoryExists] = await Promise.all([
      this.referenceOwnership.fundingAccountExistsForUser(
        command.userId,
        command.fundingAccountId
      ),
      this.referenceOwnership.categoryExistsForUser(
        command.userId,
        command.categoryId
      )
    ]);

    const missingReference = resolveMissingOwnedCollectedTransactionReference({
      fundingAccountExists,
      categoryExists
    });

    if (missingReference) {
      throw new MissingOwnedCollectedTransactionReferenceError(missingReference);
    }

    const transaction = await this.collectedTransactionStore.createForUser({
      userId: command.userId,
      title: command.title,
      type: command.type,
      amountWon: command.amountWon,
      businessDate: new Date(command.businessDate),
      fundingAccountId: command.fundingAccountId,
      categoryId: command.categoryId,
      memo: command.memo
    });

    return mapCollectedTransactionToItem(transaction);
  }
}
