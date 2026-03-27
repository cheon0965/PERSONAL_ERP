import type { TransactionItem } from '@personal-erp/contracts';
import type { CreateTransactionRequest } from '@personal-erp/contracts';
import {
  MissingOwnedTransactionReferenceError,
  resolveMissingOwnedTransactionReference
} from '../../domain/transaction-policy';
import type { ReferenceOwnershipPort } from '../ports/reference-ownership.port';
import type { TransactionStorePort } from '../ports/transaction-store.port';
import { mapTransactionToItem } from '../transaction-item.mapper';

type CreateTransactionCommand = CreateTransactionRequest & {
  userId: string;
};

export class CreateTransactionUseCase {
  constructor(
    private readonly transactionStore: TransactionStorePort,
    private readonly referenceOwnership: ReferenceOwnershipPort
  ) {}

  async execute(command: CreateTransactionCommand): Promise<TransactionItem> {
    const [accountExists, categoryExists] = await Promise.all([
      this.referenceOwnership.accountExistsForUser(
        command.userId,
        command.accountId
      ),
      this.referenceOwnership.categoryExistsForUser(
        command.userId,
        command.categoryId
      )
    ]);

    const missingReference = resolveMissingOwnedTransactionReference({
      accountExists,
      categoryExists
    });

    if (missingReference) {
      throw new MissingOwnedTransactionReferenceError(missingReference);
    }

    const transaction = await this.transactionStore.createForUser({
      userId: command.userId,
      title: command.title,
      type: command.type,
      amountWon: command.amountWon,
      businessDate: new Date(command.businessDate),
      accountId: command.accountId,
      categoryId: command.categoryId,
      memo: command.memo
    });

    return mapTransactionToItem(transaction);
  }
}
