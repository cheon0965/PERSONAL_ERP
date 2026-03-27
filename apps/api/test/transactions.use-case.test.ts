import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionType } from '@prisma/client';
import { CreateTransactionUseCase } from '../src/modules/transactions/application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from '../src/modules/transactions/application/use-cases/list-transactions.use-case';
import { MissingOwnedTransactionReferenceError } from '../src/modules/transactions/domain/transaction-policy';

const createTransactionCommand = {
  userId: 'user-1',
  title: 'Fuel refill',
  type: TransactionType.EXPENSE,
  amountWon: 84000,
  businessDate: '2026-03-03',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  memo: 'Full tank'
};

test('CreateTransactionUseCase executes ownership checks before persisting the transaction', async () => {
  const storeCalls: Array<Record<string, unknown>> = [];
  const transactionStore = {
    findRecentByUserId: async () => [],
    createForUser: async (record: Record<string, unknown>) => {
      storeCalls.push(record);
      return {
        id: 'txn-1',
        ...record,
        businessDate: new Date('2026-03-03T00:00:00.000Z'),
        origin: 'MANUAL',
        status: 'POSTED',
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      };
    }
  };
  const referenceOwnership = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => true
  };

  const useCase = new CreateTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(createTransactionCommand);

  assert.equal(storeCalls.length, 1);
  assert.deepEqual(storeCalls[0], {
    userId: 'user-1',
    title: 'Fuel refill',
    type: TransactionType.EXPENSE,
    amountWon: 84000,
    businessDate: new Date('2026-03-03T00:00:00.000Z'),
    accountId: 'acc-1',
    categoryId: 'cat-1',
    memo: 'Full tank'
  });
  assert.deepEqual(result, {
    id: 'txn-1',
    businessDate: '2026-03-03',
    title: 'Fuel refill',
    type: TransactionType.EXPENSE,
    amountWon: 84000,
    accountName: 'Main checking',
    categoryName: 'Fuel',
    origin: 'MANUAL',
    status: 'POSTED'
  });
});

test('CreateTransactionUseCase rejects requests for accounts outside the current user scope', async () => {
  const transactionStore = {
    findRecentByUserId: async () => [],
    createForUser: async () => ({})
  };
  const referenceOwnership = {
    accountExistsForUser: async () => false,
    categoryExistsForUser: async () => true
  };

  const useCase = new CreateTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createTransactionCommand),
    (error: unknown) =>
      error instanceof MissingOwnedTransactionReferenceError &&
      error.message === 'Account not found'
  );
});

test('CreateTransactionUseCase rejects requests for categories outside the current user scope', async () => {
  const transactionStore = {
    findRecentByUserId: async () => [],
    createForUser: async () => ({})
  };
  const referenceOwnership = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => false
  };

  const useCase = new CreateTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createTransactionCommand),
    (error: unknown) =>
      error instanceof MissingOwnedTransactionReferenceError &&
      error.message === 'Category not found'
  );
});

test('ListTransactionsUseCase maps stored transactions into the shared response shape', async () => {
  const transactionStore = {
    findRecentByUserId: async () => [
      {
        id: 'txn-1',
        businessDate: new Date('2026-03-03T00:00:00.000Z'),
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        origin: 'MANUAL',
        status: 'POSTED',
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      }
    ],
    createForUser: async () => {
      throw new Error('createForUser should not be called');
    }
  };

  const useCase = new ListTransactionsUseCase(transactionStore as never);
  const result = await useCase.execute('user-1');

  assert.deepEqual(result, [
    {
      id: 'txn-1',
      businessDate: '2026-03-03',
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      accountName: 'Main checking',
      categoryName: 'Fuel',
      origin: 'MANUAL',
      status: 'POSTED'
    }
  ]);
});
