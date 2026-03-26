import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { RecurrenceFrequency } from '@prisma/client';
import { RecurringRulesService } from '../src/modules/recurring-rules/recurring-rules.service';

const createRecurringRuleDto = {
  title: 'Phone bill',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  amountWon: 75000,
  frequency: RecurrenceFrequency.MONTHLY,
  dayOfMonth: 10,
  startDate: '2026-03-10',
  isActive: true
};

test('RecurringRulesService.create persists a rule after ownership checks pass', async () => {
  const calls: Array<{
    userId: string;
    dto: typeof createRecurringRuleDto;
  }> = [];
  const repository = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => true,
    createForUser: async (
      userId: string,
      dto: typeof createRecurringRuleDto
    ) => {
      calls.push({ userId, dto });
      return { id: 'rr-1', ...dto, userId };
    }
  };

  const service = new RecurringRulesService(repository as never);
  const result = await service.create('user-1', createRecurringRuleDto);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    userId: 'user-1',
    dto: createRecurringRuleDto
  });
  assert.equal(result.id, 'rr-1');
});

test('RecurringRulesService.create rejects missing accounts', async () => {
  const repository = {
    accountExistsForUser: async () => false,
    categoryExistsForUser: async () => true,
    createForUser: async () => ({})
  };

  const service = new RecurringRulesService(repository as never);

  await assert.rejects(
    () => service.create('user-1', createRecurringRuleDto),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === 'Account not found'
  );
});

test('RecurringRulesService.create rejects missing categories', async () => {
  const repository = {
    accountExistsForUser: async () => true,
    categoryExistsForUser: async () => false,
    createForUser: async () => ({})
  };

  const service = new RecurringRulesService(repository as never);

  await assert.rejects(
    () => service.create('user-1', createRecurringRuleDto),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === 'Category not found'
  );
});
