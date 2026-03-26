import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

const createTransactionDto = {
  title: 'Fuel refill',
  type: TransactionType.EXPENSE,
  amountWon: 84000,
  businessDate: '2026-03-03',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  memo: 'Full tank'
};

test('TransactionsService.create persists a transaction after ownership checks pass', async () => {
  const calls: Array<{ userId: string; dto: typeof createTransactionDto }> = [];
  const repository = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => true,
    createForUser: async (userId: string, dto: typeof createTransactionDto) => {
      calls.push({ userId, dto });
      return { id: 'txn-1', ...dto, userId };
    }
  };

  const service = new TransactionsService(repository as never);
  const result = await service.create('user-1', createTransactionDto);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    userId: 'user-1',
    dto: createTransactionDto
  });
  assert.equal(result.id, 'txn-1');
});

test('TransactionsService.create rejects requests for accounts outside the current user scope', async () => {
  const repository = {
    accountExistsForUser: async () => false,
    categoryExistsForUser: async () => true,
    createForUser: async () => ({})
  };

  const service = new TransactionsService(repository as never);

  await assert.rejects(
    () => service.create('user-1', createTransactionDto),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === 'Account not found'
  );
});

test('TransactionsService.create rejects requests for categories outside the current user scope', async () => {
  const repository = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => false,
    createForUser: async () => ({})
  };

  const service = new TransactionsService(repository as never);

  await assert.rejects(
    () => service.create('user-1', createTransactionDto),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === 'Category not found'
  );
});
