import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurrenceFrequency } from '@prisma/client';
import { CreateRecurringRuleUseCase } from '../src/modules/recurring-rules/application/use-cases/create-recurring-rule.use-case';
import { DeleteRecurringRuleUseCase } from '../src/modules/recurring-rules/application/use-cases/delete-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from '../src/modules/recurring-rules/application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from '../src/modules/recurring-rules/application/use-cases/update-recurring-rule.use-case';
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

const updateRecurringRuleCommand = {
  recurringRuleId: 'rr-1',
  tenantId: 'tenant-1',
  ledgerId: 'ledger-1',
  title: 'Phone bill revised',
  fundingAccountId: 'acc-1',
  categoryId: 'cat-1',
  amountWon: 88000,
  frequency: RecurrenceFrequency.MONTHLY,
  dayOfMonth: 15,
  startDate: '2026-03-15',
  endDate: '2026-12-15',
  isActive: false
};

test('UpdateRecurringRuleUseCase persists updated schedule data after ownership checks pass', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const recurringRuleStore = {
    findAllInWorkspace: async () => [],
    findByIdInWorkspace: async () => ({
      id: 'rr-1',
      title: 'Phone bill',
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 10,
      startDate: new Date('2026-03-10T00:00:00.000Z'),
      endDate: null,
      nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
      isActive: true
    }),
    createInWorkspace: async () => {
      throw new Error('createInWorkspace should not be called');
    },
    updateInWorkspace: async (
      _tenantId: string,
      _ledgerId: string,
      record: Record<string, unknown>
    ) => {
      calls.push(record);
      return {
        id: 'rr-1',
        title: 'Phone bill revised',
        amountWon: 88000,
        frequency: RecurrenceFrequency.MONTHLY,
        nextRunDate: new Date('2026-03-15T00:00:00.000Z'),
        isActive: false,
        account: { name: 'Main checking' },
        category: { name: 'Fuel' }
      };
    }
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => true
  };

  const useCase = new UpdateRecurringRuleUseCase(
    recurringRuleStore as never,
    referenceOwnership as never
  );

  const result = await useCase.execute(updateRecurringRuleCommand);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    id: 'rr-1',
    title: 'Phone bill revised',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    amountWon: 88000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 15,
    startDate: new Date('2026-03-15T00:00:00.000Z'),
    endDate: new Date('2026-12-15T00:00:00.000Z'),
    isActive: false,
    nextRunDate: new Date('2026-03-15T00:00:00.000Z')
  });
  assert.deepEqual(result, {
    id: 'rr-1',
    title: 'Phone bill revised',
    amountWon: 88000,
    frequency: RecurrenceFrequency.MONTHLY,
    nextRunDate: '2026-03-15',
    fundingAccountName: 'Main checking',
    categoryName: 'Fuel',
    isActive: false
  });
});

test('UpdateRecurringRuleUseCase rejects missing categories on update', async () => {
  const recurringRuleStore = {
    findAllInWorkspace: async () => [],
    findByIdInWorkspace: async () => ({
      id: 'rr-1',
      title: 'Phone bill',
      accountId: 'acc-1',
      categoryId: 'cat-1c',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 10,
      startDate: new Date('2026-03-10T00:00:00.000Z'),
      endDate: null,
      nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
      isActive: true
    }),
    createInWorkspace: async () => ({}),
    updateInWorkspace: async () => ({})
  };
  const referenceOwnership = {
    fundingAccountExistsInWorkspace: async () => true,
    categoryExistsInWorkspace: async () => false
  };

  const useCase = new UpdateRecurringRuleUseCase(
    recurringRuleStore as never,
    referenceOwnership as never
  );

  await assert.rejects(
    () => useCase.execute(updateRecurringRuleCommand),
    (error: unknown) =>
      error instanceof MissingOwnedRecurringRuleReferenceError &&
      error.message === 'Category not found'
  );
});

test('DeleteRecurringRuleUseCase deletes an existing recurring rule', async () => {
  const calls: Array<Record<string, string>> = [];
  const recurringRuleStore = {
    findByIdInWorkspace: async () => ({
      id: 'rr-1',
      title: 'Phone bill',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amountWon: 75000,
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 10,
      startDate: new Date('2026-03-10T00:00:00.000Z'),
      endDate: null,
      nextRunDate: new Date('2026-03-10T00:00:00.000Z'),
      isActive: true
    }),
    deleteInWorkspace: async (
      tenantId: string,
      ledgerId: string,
      recurringRuleId: string
    ) => {
      calls.push({ tenantId, ledgerId, recurringRuleId });
      return true;
    }
  };

  const useCase = new DeleteRecurringRuleUseCase(recurringRuleStore as never);
  const result = await useCase.execute({
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    recurringRuleId: 'rr-1'
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [
    {
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      recurringRuleId: 'rr-1'
    }
  ]);
});

test('DeleteRecurringRuleUseCase returns false when the recurring rule is missing', async () => {
  const recurringRuleStore = {
    findByIdInWorkspace: async () => null,
    deleteInWorkspace: async () => true
  };

  const useCase = new DeleteRecurringRuleUseCase(recurringRuleStore as never);
  const result = await useCase.execute({
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    recurringRuleId: 'missing-rule'
  });

  assert.equal(result, false);
});
