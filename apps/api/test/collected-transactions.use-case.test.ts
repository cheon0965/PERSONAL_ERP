import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { CreateCollectedTransactionUseCase } from '../src/modules/collected-transactions/application/use-cases/create-collected-transaction.use-case';
import { DeleteCollectedTransactionUseCase } from '../src/modules/collected-transactions/application/use-cases/delete-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from '../src/modules/collected-transactions/application/use-cases/list-collected-transactions.use-case';
import { UpdateCollectedTransactionUseCase } from '../src/modules/collected-transactions/application/use-cases/update-collected-transaction.use-case';
import { MissingOwnedCollectedTransactionReferenceError } from '../src/modules/collected-transactions/domain/collected-transaction-policy';

const createCollectedTransactionCommand = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  ledgerId: 'ledger-1',
  periodId: 'period-1',
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
    findRecentInWorkspace: async () => [],
    createInWorkspace: async (record: Record<string, unknown>) => {
      storeCalls.push(record);
      return {
        id: 'txn-1',
        ...record,
        businessDate: new Date('2026-03-03T00:00:00.000Z'),
        origin: 'MANUAL',
        status: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      };
    }
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new CreateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(createCollectedTransactionCommand);

  assert.equal(storeCalls.length, 1);
  assert.deepEqual(storeCalls[0], {
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-1',
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
    postingStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  });
});

test('CreateCollectedTransactionUseCase rejects requests for funding accounts outside the current user scope', async () => {
  const transactionStore = {
    findRecentInWorkspace: async () => [],
    createInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => false,
    categoryExistsInWorkspace: async () => true
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
    findRecentInWorkspace: async () => [],
    createInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => false
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

test('ListCollectedTransactionsUseCase maps stored collected transactions into the shared response shape', async () => {
  const transactionStore = {
    findRecentInWorkspace: async () => [
      {
        id: 'txn-1',
        businessDate: new Date('2026-03-03T00:00:00.000Z'),
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        origin: 'MANUAL',
        status: 'POSTED',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      }
    ],
    createInWorkspace: async () => {
      throw new Error('createInWorkspace should not be called');
    }
  };

  const useCase = new ListCollectedTransactionsUseCase(
    transactionStore as never
  );
  const result = await useCase.execute({
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1'
  });

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
      postingStatus: 'POSTED',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null,
      matchedPlanItemId: null,
      matchedPlanItemTitle: null
    }
  ]);
});

const updateCollectedTransactionCommand = {
  collectedTransactionId: 'txn-1',
  tenantId: 'tenant-1',
  ledgerId: 'ledger-1',
  periodId: 'period-1',
  title: 'Fuel refill adjusted',
  type: TransactionType.EXPENSE,
  amountWon: 91000,
  businessDate: '2026-03-04',
  fundingAccountId: 'acc-1',
  categoryId: 'cat-1',
  memo: 'Adjusted after receipt review'
};

test('UpdateCollectedTransactionUseCase updates only unposted collected transactions and maps the shared response shape', async () => {
  const storeCalls: Array<Record<string, unknown>> = [];
  const transactionStore = {
    findRecentInWorkspace: async () => [],
    findByIdInWorkspace: async () => ({
      id: 'txn-1',
      businessDate: new Date('2026-03-03T00:00:00.000Z'),
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      memo: 'Full tank',
      origin: 'MANUAL',
      status: 'READY_TO_POST',
      postedJournalEntryId: null,
      postedJournalEntryNumber: null
    }),
    createInWorkspace: async () => {
      throw new Error('createInWorkspace should not be called');
    },
    updateInWorkspace: async (
      _workspace: unknown,
      record: Record<string, unknown>
    ) => {
      storeCalls.push(record);
      return {
        id: 'txn-1',
        businessDate: new Date('2026-03-04T00:00:00.000Z'),
        title: 'Fuel refill adjusted',
        type: TransactionType.EXPENSE,
        amountWon: 91000,
        origin: 'MANUAL',
        status: 'READY_TO_POST',
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      };
    }
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new UpdateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(updateCollectedTransactionCommand);

  assert.equal(storeCalls.length, 1);
  assert.deepEqual(storeCalls[0], {
    id: 'txn-1',
    periodId: 'period-1',
    title: 'Fuel refill adjusted',
    type: TransactionType.EXPENSE,
    amountWon: 91000,
    businessDate: new Date('2026-03-04T00:00:00.000Z'),
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    memo: 'Adjusted after receipt review'
  });
  assert.deepEqual(result, {
    id: 'txn-1',
    businessDate: '2026-03-04',
    title: 'Fuel refill adjusted',
    type: TransactionType.EXPENSE,
    amountWon: 91000,
    fundingAccountName: 'Main checking',
    categoryName: 'Fuel',
    sourceKind: 'MANUAL',
    postingStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    matchedPlanItemId: null,
    matchedPlanItemTitle: null
  });
});

test('UpdateCollectedTransactionUseCase rejects already posted collected transactions', async () => {
  const transactionStore = {
    findRecentInWorkspace: async () => [],
    findByIdInWorkspace: async () => ({
      id: 'txn-1',
      businessDate: new Date('2026-03-03T00:00:00.000Z'),
      title: 'Fuel refill',
      type: TransactionType.EXPENSE,
      amountWon: 84000,
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      memo: 'Full tank',
      origin: 'MANUAL',
      status: 'POSTED',
      postedJournalEntryId: 'je-1',
      postedJournalEntryNumber: '202603-0001'
    }),
    createInWorkspace: async () => ({}),
    updateInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new UpdateCollectedTransactionUseCase(
    transactionStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(updateCollectedTransactionCommand),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message ===
        'Posted collected transactions must be adjusted through journal entries.'
  );
});

test('DeleteCollectedTransactionUseCase deletes an unposted collected transaction', async () => {
  const storeCalls: Array<Record<string, unknown>> = [];
  const transactionStore = {
    findByIdInWorkspace: async () => ({
      id: 'txn-1',
      status: 'READY_TO_POST',
      postedJournalEntryId: null
    }),
    deleteInWorkspace: async (
      workspace: Record<string, unknown>,
      id: string
    ) => {
      storeCalls.push({ ...workspace, id });
      return true;
    }
  };

  const useCase = new DeleteCollectedTransactionUseCase(
    transactionStore as never
  );

  const result = await useCase.execute(
    {
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1'
    },
    'txn-1'
  );

  assert.equal(result, true);
  assert.deepEqual(storeCalls, [
    {
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      id: 'txn-1'
    }
  ]);
});

test('DeleteCollectedTransactionUseCase rejects posted collected transactions', async () => {
  const transactionStore = {
    findByIdInWorkspace: async () => ({
      id: 'txn-1',
      status: 'POSTED',
      postedJournalEntryId: 'je-1'
    }),
    deleteInWorkspace: async () => true
  };

  const useCase = new DeleteCollectedTransactionUseCase(
    transactionStore as never
  );

  await assert.rejects(
    () =>
      useCase.execute(
        {
          tenantId: 'tenant-1',
          ledgerId: 'ledger-1'
        },
        'txn-1'
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message ===
        'Posted collected transactions must be adjusted through journal entries.'
  );
});
