import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionType } from '@prisma/client';
import { CreateCollectedTransactionUseCase } from '../src/modules/collected-transactions/application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from '../src/modules/collected-transactions/application/use-cases/list-collected-transactions.use-case';
import { MissingOwnedCollectedTransactionReferenceError } from '../src/modules/collected-transactions/domain/collected-transaction-policy';

const createCollectedTransactionCommand = {
  userId: 'user-1',
  title: 'Fuel refill',
  type: TransactionType.EXPENSE,
  amountWon: 84000,
  businessDate: '2026-03-03',
  fundingAccountId: 'acc-1',
  categoryId: 'cat-1',
  memo: 'Full tank'
};

test('CreateCollectedTransactionUseCase executes ownership checks before persisting the collected transaction', async () => {
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
    fundingAccountExistsForUser: async () => true,
    categoryExistsForUser: async () => true
  };

  const useCase = new CreateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(createCollectedTransactionCommand);

  assert.equal(storeCalls.length, 1);
  assert.deepEqual(storeCalls[0], {
    userId: 'user-1',
    title: 'Fuel refill',
    type: TransactionType.EXPENSE,
    amountWon: 84000,
    businessDate: new Date('2026-03-03T00:00:00.000Z'),
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    memo: 'Full tank'
  });
  assert.deepEqual(result, {
    id: 'txn-1',
    businessDate: '2026-03-03',
    title: 'Fuel refill',
    type: TransactionType.EXPENSE,
    amountWon: 84000,
    fundingAccountName: 'Main checking',
    categoryName: 'Fuel',
    sourceKind: 'MANUAL',
    postingStatus: 'POSTED'
  });
});

test('CreateCollectedTransactionUseCase rejects requests for funding accounts outside the current user scope', async () => {
  const transactionStore = {
    findRecentByUserId: async () => [],
    createForUser: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsForUser: async () => false,
    categoryExistsForUser: async () => true
  };

  const useCase = new CreateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createCollectedTransactionCommand),
    (error: unknown) =>
      error instanceof MissingOwnedCollectedTransactionReferenceError &&
      error.message === 'Funding account not found'
  );
});

test('CreateCollectedTransactionUseCase rejects requests for categories outside the current user scope', async () => {
  const transactionStore = {
    findRecentByUserId: async () => [],
    createForUser: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsForUser: async () => true,
    categoryExistsForUser: async () => false
  };

  const useCase = new CreateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createCollectedTransactionCommand),
    (error: unknown) =>
      error instanceof MissingOwnedCollectedTransactionReferenceError &&
      error.message === 'Category not found'
  );
});

test('ListCollectedTransactionsUseCase maps stored transactions into the shared response shape', async () => {
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

  const useCase = new ListCollectedTransactionsUseCase(
    transactionStore as never
  );
  const result = await useCase.execute('user-1');

  assert.deepEqual(result, [
    {
      id: 'txn-1',
      businessDate: '2026-03-03',
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      sourceKind: 'MANUAL',
      postingStatus: 'POSTED'
    }
  ]);
});
