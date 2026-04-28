import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('GET /funding-accounts returns only active funding accounts for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /funding-accounts?includeInactive=true includes inactive funding accounts for the current workspace ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request(
      '/funding-accounts?includeInactive=true',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1c',
        name: 'Legacy cashbox',
        type: 'CASH',
        balanceWon: 0,
        status: 'INACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('GET /funding-accounts derives a live balance from opening data and transactions when stored balance is zero', async () => {
  const context = await createRequestTestContext();

  try {
    const acc1 = context.state.accounts.find((a) => a.id === 'acc-1');
    if (acc1) {
      acc1.balanceWon = 0;
    }

    context.state.accountingPeriods.push({
      id: 'period-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 2,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-live-balance-1',
      sourceKind: 'INITIAL_SETUP',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.balanceSnapshotLines.push({
      id: 'balance-live-opening-1',
      snapshotKind: 'OPENING',
      openingSnapshotId: 'opening-live-balance-1',
      closingSnapshotId: null,
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: 1_000_000
    });
    context.state.journalEntries.push({
      id: 'je-live-before-import-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-live-balance-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-05T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-live-before-import-1',
      reversesJournalEntryId: null,
      correctsJournalEntryId: null,
      correctionReason: null,
      status: 'POSTED',
      memo: 'Imported before anchor',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-05T01:00:00.000Z'),
      updatedAt: new Date('2026-03-05T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-live-before-import-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 50_000,
          creditAmount: 0,
          description: 'Imported before anchor'
        },
        {
          id: 'jel-live-before-import-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-4100',
          fundingAccountId: null,
          debitAmount: 0,
          creditAmount: 50_000,
          description: 'Imported before anchor'
        }
      ]
    });
    context.state.collectedTransactions.push(
      {
        id: 'ctx-live-before-import-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-income',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1b',
        matchedPlanItemId: null,
        importBatchId: null,
        importedRowId: null,
        sourceFingerprint: null,
        title: 'Imported before anchor',
        occurredOn: new Date('2026-03-05T00:00:00.000Z'),
        amount: 50_000,
        status: 'POSTED',
        memo: null,
        createdAt: new Date('2026-03-05T01:00:00.000Z'),
        updatedAt: new Date('2026-03-05T01:00:00.000Z')
      },
      {
        id: 'ctx-live-import-anchor-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-income',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1b',
        matchedPlanItemId: null,
        importBatchId: 'batch-live-balance-1',
        importedRowId: 'row-live-balance-1',
        sourceFingerprint: 'sf-live-anchor-1',
        title: 'Statement anchor deposit',
        occurredOn: new Date('2026-03-10T00:00:00.000Z'),
        amount: 120_000,
        status: 'READY_TO_POST',
        memo: null,
        createdAt: new Date('2026-03-10T00:30:00.000Z'),
        updatedAt: new Date('2026-03-10T00:30:00.000Z')
      },
      {
        id: 'ctx-live-after-anchor-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-live-balance-1',
        ledgerTransactionTypeId: 'ltt-1-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-1',
        matchedPlanItemId: null,
        importBatchId: null,
        importedRowId: null,
        sourceFingerprint: null,
        title: 'After anchor expense',
        occurredOn: new Date('2026-03-11T00:00:00.000Z'),
        amount: 10_000,
        status: 'READY_TO_POST',
        memo: null,
        createdAt: new Date('2026-03-11T01:00:00.000Z'),
        updatedAt: new Date('2026-03-11T01:00:00.000Z')
      }
    );
    context.state.importBatches.push({
      id: 'batch-live-balance-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-live-balance-1',
      sourceKind: 'IM_BANK_PDF',
      fileName: 'live-balance.pdf',
      fileHash: 'file-hash-live-balance-1',
      fundingAccountId: 'acc-1',
      rowCount: 1,
      parseStatus: 'COMPLETED',
      uploadedByMembershipId: 'membership-1',
      uploadedAt: new Date('2026-03-10T00:00:00.000Z')
    });
    context.state.importedRows.push({
      id: 'row-live-balance-1',
      batchId: 'batch-live-balance-1',
      rowNumber: 10,
      rawPayload: {
        parsed: {
          occurredOn: '2026-03-10',
          occurredAt: '2026-03-10T09:00:00+09:00',
          title: 'Statement anchor deposit',
          amount: 120_000,
          signedAmount: 120_000,
          balanceAfter: 1_120_000,
          direction: 'DEPOSIT'
        }
      },
      parseStatus: 'PARSED',
      parseError: null,
      sourceFingerprint: 'sf-live-anchor-1'
    });

    const response = await context.request('/funding-accounts', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'acc-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 1_160_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts creates a funding account for the current workspace when the membership can manage reference data', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Operations cashbox',
        type: 'CASH'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-generated-4',
      name: 'Operations cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
    assert.deepEqual(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-generated-4'
      ),
      {
        id: 'acc-generated-4',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Operations cashbox',
        normalizedName: 'operations cashbox',
        type: 'CASH',
        balanceWon: 0,
        sortOrder: 2,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.create' &&
          event.eventName === 'audit.action_succeeded' &&
          event.result === 'SUCCESS' &&
          event.resourceId === 'acc-generated-4'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts marks new bank and card accounts as pending bootstrap', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'New statement account',
        type: 'BANK'
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-generated-4',
      name: 'New statement account',
      type: 'BANK',
      balanceWon: 0,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });
    assert.equal(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-generated-4'
      )?.bootstrapStatus,
      'PENDING'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id can mark pending bootstrap as completed', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-pending-bootstrap',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Pending statement account',
      normalizedName: 'pending statement account',
      type: 'BANK',
      balanceWon: 0,
      sortOrder: 3,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });

    const response = await context.request(
      '/funding-accounts/acc-pending-bootstrap',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          name: 'Pending statement account',
          bootstrapStatus: 'COMPLETED'
        }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(
      (response.body as { bootstrapStatus: string }).bootstrapStatus,
      'COMPLETED'
    );
    assert.equal(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-pending-bootstrap'
      )?.bootstrapStatus,
      'COMPLETED'
    );
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts returns 403 when the current membership cannot create funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'EDITOR';

    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Operations cashbox',
        type: 'CASH'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.create' &&
          event.eventName === 'authorization.action_denied' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /funding-accounts/:id deletes an unused funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-clean-delete',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Mistaken account',
      normalizedName: 'mistaken account',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 5,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });

    const response = await context.request(
      '/funding-accounts/acc-clean-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 204);
    assert.equal(
      context.state.accounts.some(
        (candidate) => candidate.id === 'acc-clean-delete'
      ),
      false
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.delete' &&
          event.eventName === 'audit.action_succeeded' &&
          event.result === 'SUCCESS' &&
          event.resourceId === 'acc-clean-delete'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /funding-accounts/:id rejects deleting a funding account with transaction history', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-history-delete',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Account with history',
      normalizedName: 'account with history',
      type: 'BANK',
      balanceWon: 0,
      sortOrder: 5,
      status: 'INACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
    context.state.collectedTransactions.push({
      id: 'ctx-history-delete',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: null,
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-history-delete',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: null,
      title: 'Historical expense',
      occurredOn: new Date('2026-04-01T00:00:00.000Z'),
      amount: 10_000,
      status: CollectedTransactionStatus.COLLECTED,
      memo: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const response = await context.request(
      '/funding-accounts/acc-history-delete',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.match(errorBody.message, /수집 거래 1건/);
    assert.equal(
      context.state.accounts.some(
        (candidate) => candidate.id === 'acc-history-delete'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /funding-accounts/:id returns 403 when the current membership cannot delete funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';
    context.state.accounts.push({
      id: 'acc-clean-delete-viewer',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Viewer delete account',
      normalizedName: 'viewer delete account',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 5,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });

    const response = await context.request(
      '/funding-accounts/acc-clean-delete-viewer',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'funding_account.delete' &&
          event.eventName === 'authorization.action_denied' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id renames and deactivates a funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main operating account',
        status: 'INACTIVE'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1',
      name: 'Main operating account',
      type: 'BANK',
      balanceWon: 2_000_000,
      status: 'INACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
    assert.deepEqual(
      context.state.accounts.find((candidate) => candidate.id === 'acc-1'),
      {
        id: 'acc-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Main operating account',
        normalizedName: 'main operating account',
        type: 'BANK',
        balanceWon: 2_000_000,
        sortOrder: 0,
        status: 'INACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id can reactivate an inactive funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Legacy cashbox',
        status: 'ACTIVE'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1c',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'ACTIVE',
      bootstrapStatus: 'NOT_REQUIRED'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id can close an inactive funding account for the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      sortOrder: 3,
      status: 'INACTIVE'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Legacy cashbox',
        status: 'CLOSED'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'acc-1c',
      name: 'Legacy cashbox',
      type: 'CASH',
      balanceWon: 0,
      status: 'CLOSED',
      bootstrapStatus: 'NOT_REQUIRED'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id rejects closing an active funding account without first deactivating it', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main checking',
        status: 'CLOSED'
      }
    });

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.equal(
      errorBody.message,
      '자금수단을 종료하려면 먼저 비활성 상태로 전환해 주세요.'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id rejects updating a closed funding account', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-1c',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Closed settlement card',
      type: 'CARD',
      balanceWon: 0,
      sortOrder: 3,
      status: 'CLOSED'
    });

    const response = await context.request('/funding-accounts/acc-1c', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Closed settlement card renamed',
        status: 'ACTIVE'
      }
    });

    assert.equal(response.status, 409);
    const errorBody = response.body as { message: string };
    assert.equal(
      errorBody.message,
      '종료된 자금수단은 현재 범위에서 수정할 수 없습니다.'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /funding-accounts/:id returns 403 when the current membership cannot update funding accounts', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'VIEWER';

    const response = await context.request('/funding-accounts/acc-1', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Main operating account',
        status: 'INACTIVE'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
