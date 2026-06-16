import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountingPeriodStatus } from '@prisma/client';
import { createRequestTestContext } from '../../../support/request-api/index';

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

test('POST /funding-accounts creates an opening balance journal when an initial balance is provided', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-opening-balance-create',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });

    const response = await context.request('/funding-accounts', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        name: 'Initial balance bank',
        type: 'BANK',
        initialBalanceWon: 780_000
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-generated-4',
      name: 'Initial balance bank',
      type: 'BANK',
      balanceWon: 780_000,
      status: 'ACTIVE',
      bootstrapStatus: 'COMPLETED'
    });

    const createdAccount = context.state.accounts.find(
      (candidate) => candidate.id === 'acc-generated-4'
    );
    assert.equal(createdAccount?.balanceWon, 780_000);
    assert.equal(createdAccount?.bootstrapStatus, 'COMPLETED');

    const openingEntry = context.state.journalEntries.find(
      (entry) => entry.sourceKind === 'OPENING_BALANCE'
    );
    assert.ok(openingEntry);
    assert.equal(openingEntry.periodId, 'period-opening-balance-create');
    assert.equal(openingEntry.entryNumber, '202604-0001');
    assert.deepEqual(openingEntry.lines, [
      {
        id: 'jel-1-1',
        lineNumber: 1,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-generated-4',
        debitAmount: 780_000,
        creditAmount: 0,
        description: '기초금액 등록'
      },
      {
        id: 'jel-1-2',
        lineNumber: 2,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        debitAmount: 0,
        creditAmount: 780_000,
        description: '기초금액 등록'
      }
    ]);
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

test('POST /funding-accounts/:id/bootstrap completes pending bootstrap with an optional opening balance', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-bootstrap-opening',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      nextJournalEntrySequence: 1,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.accounts.push({
      id: 'acc-pending-bootstrap-opening',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Pending opening account',
      normalizedName: 'pending opening account',
      type: 'BANK',
      balanceWon: 0,
      sortOrder: 3,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });

    const response = await context.request(
      '/funding-accounts/acc-pending-bootstrap-opening/bootstrap',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          initialBalanceWon: 450_000
        }
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-pending-bootstrap-opening',
      name: 'Pending opening account',
      type: 'BANK',
      balanceWon: 450_000,
      status: 'ACTIVE',
      bootstrapStatus: 'COMPLETED'
    });
    assert.equal(
      context.state.accounts.find(
        (candidate) => candidate.id === 'acc-pending-bootstrap-opening'
      )?.balanceWon,
      450_000
    );
    assert.equal(context.state.journalEntries.length, 1);
    assert.equal(
      context.state.journalEntries[0]?.sourceKind,
      'OPENING_BALANCE'
    );
    assert.deepEqual(context.state.journalEntries[0]?.lines, [
      {
        id: 'jel-1-1',
        lineNumber: 1,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-pending-bootstrap-opening',
        debitAmount: 450_000,
        creditAmount: 0,
        description: '기초금액 등록'
      },
      {
        id: 'jel-1-2',
        lineNumber: 2,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        debitAmount: 0,
        creditAmount: 450_000,
        description: '기초금액 등록'
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /funding-accounts/:id/bootstrap can complete pending bootstrap without an opening balance', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accounts.push({
      id: 'acc-pending-bootstrap-zero',
      userId: 'user-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      name: 'Pending zero account',
      normalizedName: 'pending zero account',
      type: 'CARD',
      balanceWon: 0,
      sortOrder: 3,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING'
    });

    const response = await context.request(
      '/funding-accounts/acc-pending-bootstrap-zero/bootstrap',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {}
      }
    );

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      id: 'acc-pending-bootstrap-zero',
      name: 'Pending zero account',
      type: 'CARD',
      balanceWon: 0,
      status: 'ACTIVE',
      bootstrapStatus: 'COMPLETED'
    });
    assert.equal(context.state.journalEntries.length, 0);
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
