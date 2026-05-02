import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  PostingPolicyKey
} from '@prisma/client';
import { ConfirmCollectedTransactionUseCase } from '../src/modules/collected-transactions/confirm-collected-transaction.use-case';
import type {
  ConfirmationCollectedTransaction,
  CreateConfirmationJournalEntryInput
} from '../src/modules/collected-transactions/application/ports/confirm-collected-transaction-store.port';

const testUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Owner',
  currentWorkspace: {
    tenant: {
      id: 'tenant-1',
      slug: 'tenant',
      name: 'Tenant',
      status: 'ACTIVE'
    },
    membership: {
      id: 'membership-1',
      role: 'OWNER',
      status: 'ACTIVE'
    },
    ledger: {
      id: 'ledger-1',
      name: 'Primary ledger',
      baseCurrency: 'KRW',
      timezone: 'Asia/Seoul',
      status: 'ACTIVE'
    }
  }
};

test('ConfirmCollectedTransactionUseCase rejects liability confirmations when repayment posting state is not updated', async () => {
  const transaction = buildCollectedTransaction({
    matchedPlanItemId: 'plan-1',
    matchedLiabilityRepaymentSchedule: {
      id: 'repayment-1',
      principalAmount: 90000,
      interestAmount: 10000,
      feeAmount: 0,
      totalAmount: 100000,
      postedJournalEntryId: null,
      liabilityAccountSubjectId: 'sub-liability'
    }
  });
  const useCase = new ConfirmCollectedTransactionUseCase(
    createConfirmStore({
      collectedTransaction: transaction,
      liabilityRepaymentUpdatedCount: 0
    }) as never
  );

  await assert.rejects(
    () => useCase.execute(testUser, transaction.id),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '부채 상환 스케줄 상태 갱신에 실패했습니다.'
  );
});

test('ConfirmCollectedTransactionUseCase allows ordinary matched plan confirmations without liability repayment updates', async () => {
  const transaction = buildCollectedTransaction({
    matchedPlanItemId: 'plan-1',
    matchedLiabilityRepaymentSchedule: null
  });
  const useCase = new ConfirmCollectedTransactionUseCase(
    createConfirmStore({
      collectedTransaction: transaction,
      liabilityRepaymentUpdatedCount: 0
    }) as never
  );

  const result = await useCase.execute(testUser, transaction.id);

  assert.equal(result.id, 'je-1');
  assert.equal(result.entryNumber, '202603-0001');
});

function buildCollectedTransaction(
  overrides: Partial<ConfirmationCollectedTransaction> = {}
): ConfirmationCollectedTransaction {
  return {
    id: 'ctx-1',
    occurredOn: new Date('2026-03-15T00:00:00.000Z'),
    title: 'Loan repayment',
    memo: null,
    amount: 100000,
    status: CollectedTransactionStatus.READY_TO_POST,
    matchedPlanItemId: null,
    matchedLiabilityRepaymentSchedule: null,
    period: {
      id: 'period-1',
      year: 2026,
      month: 3,
      status: AccountingPeriodStatus.OPEN
    },
    fundingAccount: {
      id: 'acc-1',
      name: 'Main checking'
    },
    ledgerTransactionType: {
      postingPolicyKey: PostingPolicyKey.EXPENSE_BASIC
    },
    importedRow: null,
    postedJournalEntry: null,
    ...overrides
  };
}

function createConfirmStore(input: {
  collectedTransaction: ConfirmationCollectedTransaction;
  liabilityRepaymentUpdatedCount: number;
}) {
  const subjectById = new Map([
    ['sub-asset', { code: '1010', name: 'Cash and deposits' }],
    ['sub-liability', { code: '2100', name: 'Borrowings' }],
    ['sub-income', { code: '4100', name: 'Income' }],
    ['sub-expense', { code: '5100', name: 'Expense' }]
  ]);

  const ctx = {
    findLatestForConfirmation: async () => input.collectedTransaction,
    allocateJournalEntryNumber: async () => ({
      period: {
        id: 'period-1',
        year: 2026,
        month: 3
      },
      sequence: 1
    }),
    claimForConfirmation: async () => ({ count: 1 }),
    assertClaimSucceeded: async () => undefined,
    findActiveAccountSubjects: async () => [
      { id: 'sub-asset', code: '1010' },
      { id: 'sub-liability', code: '2100' },
      { id: 'sub-income', code: '4100' },
      { id: 'sub-expense', code: '5100' }
    ],
    createJournalEntry: async (entry: CreateConfirmationJournalEntryInput) => ({
      id: 'je-1',
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      status: entry.status,
      sourceKind: entry.sourceKind,
      memo: entry.memo,
      reversesJournalEntryId: entry.reversesJournalEntryId ?? null,
      correctsJournalEntryId: entry.correctsJournalEntryId ?? null,
      correctionReason: entry.correctionReason ?? null,
      createdByActorType: entry.createdByActorType,
      createdByMembershipId: entry.createdByMembershipId,
      sourceCollectedTransaction: {
        id: input.collectedTransaction.id,
        title: input.collectedTransaction.title
      },
      lines: entry.lines.map((line, index) => ({
        id: `jel-${index + 1}`,
        lineNumber: line.lineNumber,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description ?? null,
        accountSubject: subjectById.get(line.accountSubjectId) ?? {
          code: '0000',
          name: 'Unknown'
        },
        fundingAccount: line.fundingAccountId
          ? {
              name: input.collectedTransaction.fundingAccount.name
            }
          : null
      }))
    }),
    markMatchedPlanItemConfirmed: async () => undefined,
    markMatchedLiabilityRepaymentPosted: async () =>
      input.liabilityRepaymentUpdatedCount
  };

  return {
    findForConfirmation: async () => input.collectedTransaction,
    runInTransaction: async <T>(
      fn: (context: typeof ctx) => Promise<T>
    ): Promise<T> => fn(ctx)
  };
}
