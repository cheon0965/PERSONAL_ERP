import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurrenceFrequency } from '@prisma/client';
import { CreateRecurringRuleUseCase } from '../src/modules/recurring-rules/application/use-cases/create-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from '../src/modules/recurring-rules/application/use-cases/list-recurring-rules.use-case';
import {
  MissingOwnedRecurringRuleReferenceError,
  prepareRecurringRuleSchedule
} from '../src/modules/recurring-rules/domain/recurring-rule-policy';

const createRecurringRuleCommand = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  ledgerId: 'ledger-1',
  title: 'Phone bill',
  fundingAccountId: 'acc-1',
  categoryId: 'cat-1',
  amountWon: 75000,
  frequency: RecurrenceFrequency.MONTHLY,
  dayOfMonth: 10,
  startDate: '2026-03-10',
  isActive: true
};

test('CreateRecurringRuleUseCase persists a rule after ownership checks pass', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const recurringRuleStore = {
    findAllInWorkspace: async () => [],
    createInWorkspace: async (record: Record<string, unknown>) => {
      calls.push(record);
      return {
        id: 'rr-1',
        ...record,
        nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      };
    }
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new CreateRecurringRuleUseCase(
    recurringRuleStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(createRecurringRuleCommand);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    userId: 'user-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    title: 'Phone bill',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    amountWon: 75000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 10,
    startDate: new Date('2026-03-10T00:00:00.000Z'),
    endDate: undefined,
    isActive: true,
    nextRunDate: new Date('2026-03-10T00:00:00.000Z')
  });
  assert.deepEqual(result, {
    id: 'rr-1',
    title: 'Phone bill',
    amountWon: 75000,
    frequency: RecurrenceFrequency.MONTHLY,
    nextRunDate: '2026-03-10',
    fundingAccountName: 'Main checking',
    categoryName: 'Fuel',
    isActive: true
  });
});

test('CreateRecurringRuleUseCase rejects missing funding accounts', async () => {
  const recurringRuleStore = {
    findAllInWorkspace: async () => [],
    createInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => false,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new CreateRecurringRuleUseCase(
    recurringRuleStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createRecurringRuleCommand),
    (error: unknown) =>
      error instanceof MissingOwnedRecurringRuleReferenceError &&
      error.message === 'Funding account not found'
  );
});

test('CreateRecurringRuleUseCase rejects missing categories', async () => {
  const recurringRuleStore = {
    findAllInWorkspace: async () => [],
    createInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => false
  };

  const useCase = new CreateRecurringRuleUseCase(
    recurringRuleStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(createRecurringRuleCommand),
    (error: unknown) =>
      error instanceof MissingOwnedRecurringRuleReferenceError &&
      error.message === 'Category not found'
  );
});

test('ListRecurringRulesUseCase maps stored rules into the shared response shape', async () => {
  const recurringRuleStore = {
    findAllInWorkspace: async () => [
      {
        id: 'rr-1',
        title: 'Phone bill',
        amountWon: 75000,
        frequency: RecurrenceFrequency.MONTHLY,
        nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
        isActive: true,
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      }
    ],
    createInWorkspace: async () => {
      throw new Error('createInWorkspace should not be called');
    }
  };

  const useCase = new ListRecurringRulesUseCase(recurringRuleStore as never);
  const result = await useCase.execute({
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1'
  });

  assert.deepEqual(result, [
    {
      id: 'rr-1',
      title: 'Phone bill',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      nextRunDate: '2026-03-10',
      fundingAccountName: 'Main checking',
      categoryName: 'Fuel',
      isActive: true
    }
  ]);
});

test('prepareRecurringRuleSchedule keeps the initial recurrence policy intentionally small', () => {
  assert.deepEqual(
    prepareRecurringRuleSchedule({
      startDate: '2026-03-10',
      endDate: '2026-12-10'
    }),
    {
      startDate: new Date('2026-03-10T00:00:00.000Z'),
      endDate: new Date('2026-12-10T00:00:00.000Z'),
      isActive: true,
      nextRunDate: new Date('2026-03-10T00:00:00.000Z')
    }
  );
});
