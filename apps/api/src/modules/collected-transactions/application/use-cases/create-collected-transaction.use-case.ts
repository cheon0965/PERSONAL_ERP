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
  tenantId: string;
  ledgerId: string;
  periodId: string;
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

    const transaction = await this.collectedTransactionStore.createInWorkspace({
      tenantId: command.tenantId,
      ledgerId: command.ledgerId,
      periodId: command.periodId,
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
