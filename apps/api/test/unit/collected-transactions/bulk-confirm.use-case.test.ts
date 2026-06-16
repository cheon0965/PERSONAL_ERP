import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AuthenticatedUser,
  BulkConfirmCollectedTransactionsRequest
} from '@personal-erp/contracts';
import { BulkConfirmCollectedTransactionsUseCase } from '../../../src/modules/collected-transactions/public';

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

test('BulkConfirmCollectedTransactionsUseCase narrows ready transaction lookup when ids are requested', async () => {
  let capturedScope: unknown = null;
  let capturedRequestedIds: unknown = null;

  const confirmStore = {
    findReadyIds: async (scope: unknown, requestedIds: unknown) => {
      capturedScope = scope;
      capturedRequestedIds = requestedIds;
      return ['tx-1'];
    }
  };
  const confirmUseCase = {
    execute: async () =>
      ({
        id: 'je-1',
        entryNumber: '202603-0001'
      }) as never
  };
  const useCase = new BulkConfirmCollectedTransactionsUseCase(
    confirmStore as never,
    confirmUseCase as never
  );

  const input: BulkConfirmCollectedTransactionsRequest = {
    transactionIds: [' tx-1 ', 'tx-1', 'missing-tx']
  };
  const result = await useCase.execute(testUser, input);

  assert.deepEqual(capturedScope, {
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1'
  });
  assert.deepEqual(capturedRequestedIds, ['tx-1', 'missing-tx']);
  assert.equal(result.requestedCount, 2);
  assert.equal(result.succeededCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(
    result.results.map((item) => item.collectedTransactionId),
    ['tx-1', 'missing-tx']
  );
});
