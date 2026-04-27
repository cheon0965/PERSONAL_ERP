import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CloseAccountingPeriodResponse,
  FinancialStatementPayload
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  FinancialStatementKind,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';
test('GET /accounting-periods returns the current ledger periods in reverse chronological order', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-existing-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: new Date('2026-02-28T15:00:00.000Z'),
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-28T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-existing-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-02-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-snapshot-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-existing-1',
      sourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.accountingPeriods.push({
      id: 'period-other-1',
      tenantId: 'tenant-2',
      ledgerId: 'ledger-2',
      year: 2026,
      month: 2,
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z')
    });

    const response = await context.request('/accounting-periods', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: 'period-existing-1',
        year: 2026,
        month: 2,
        monthLabel: '2026-02',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-03-01T00:00:00.000Z',
        status: AccountingPeriodStatus.LOCKED,
        openedAt: '2026-02-01T00:00:00.000Z',
        lockedAt: '2026-02-28T15:00:00.000Z',
        hasOpeningBalanceSnapshot: true,
        openingBalanceSourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
        statusHistory: [
          {
            id: 'period-history-1',
            fromStatus: null,
            toStatus: AccountingPeriodStatus.OPEN,
            eventType: 'OPEN',
            reason: '운영 시작',
            actorType: AuditActorType.TENANT_MEMBERSHIP,
            actorMembershipId: 'membership-1',
            changedAt: '2026-02-01T00:00:00.000Z'
          }
        ]
      }
    ]);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods blocks the first period when opening balance initialization is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03'
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '첫 월 운영 시작에는 오프닝 잔액 스냅샷 생성이 필요합니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.accountingPeriods.length, 0);
    assert.equal(context.state.openingBalanceSnapshots.length, 0);
    assert.equal(context.state.periodStatusHistory.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods blocks the first period when opening balance lines are missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03',
        initializeOpeningBalance: true,
        note: '2026년 3월 운영 시작'
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message:
        '첫 월 운영 시작에는 최소 1건 이상의 오프닝 잔액 라인이 필요합니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.accountingPeriods.length, 0);
    assert.equal(context.state.openingBalanceSnapshots.length, 0);
    assert.equal(context.state.balanceSnapshotLines.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods opens the first period and records status history with an opening balance snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: 'as-1-1010',
            fundingAccountId: 'acc-1',
            balanceAmount: 3000000
          },
          {
            accountSubjectId: 'as-1-3100',
            balanceAmount: 3000000
          }
        ],
        note: '2026년 3월 운영 시작'
      }
    });

    const createdPeriod = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(createdPeriod.monthLabel, '2026-03');
    assert.equal(createdPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(createdPeriod.hasOpeningBalanceSnapshot, true);
    assert.equal(
      createdPeriod.openingBalanceSourceKind,
      OpeningBalanceSourceKind.INITIAL_SETUP
    );
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(context.state.openingBalanceSnapshots.length, 1);
    assert.equal(context.state.balanceSnapshotLines.length, 2);
    assert.equal(context.state.periodStatusHistory.length, 1);
    assert.equal(context.state.accountingPeriods[0]?.year, 2026);
    assert.equal(context.state.accountingPeriods[0]?.month, 3);
    assert.equal(
      context.state.periodStatusHistory[0]?.toStatus,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(
      context.state.periodStatusHistory[0]?.actorMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.openingBalanceSnapshots[0]?.createdByActorType,
      AuditActorType.TENANT_MEMBERSHIP
    );
    assert.equal(
      context.state.openingBalanceSnapshots[0]?.createdByMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.balanceSnapshotLines[0]?.snapshotKind,
      'OPENING'
    );
    assert.equal(
      context.state.balanceSnapshotLines[0]?.openingSnapshotId,
      context.state.openingBalanceSnapshots[0]?.id ?? null
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.open' &&
          candidate.details.periodId === createdPeriod.id
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods blocks opening a later period while the previous period is still open', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-open-existing-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-open-existing-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-open-existing-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-04',
        note: '이전 월 마감 전 오픈 시도'
      }
    });

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '새 운영 기간은 최근 운영 기간을 먼저 마감한 뒤 열 수 있습니다. 운영 중에는 하나의 최신 진행월만 열어 둡니다.',
      error: 'Conflict'
    });
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(context.state.periodStatusHistory.length, 1);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods allows the first period to open with asset-only opening balance lines', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: 'as-1-1010',
            fundingAccountId: 'acc-1',
            balanceAmount: 3000000
          }
        ],
        note: '자산만 입력한 첫 월 운영 시작'
      }
    });

    const createdPeriod = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(createdPeriod.monthLabel, '2026-03');
    assert.equal(createdPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(createdPeriod.hasOpeningBalanceSnapshot, true);
    assert.equal(
      createdPeriod.openingBalanceSourceKind,
      OpeningBalanceSourceKind.INITIAL_SETUP
    );
    assert.equal(context.state.accountingPeriods.length, 1);
    assert.equal(context.state.openingBalanceSnapshots.length, 1);
    assert.equal(context.state.balanceSnapshotLines.length, 1);
    assert.equal(
      context.state.balanceSnapshotLines[0]?.accountSubjectId,
      'as-1-1010'
    );
    assert.equal(context.state.balanceSnapshotLines[0]?.balanceAmount, 3000000);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods rolls back the opened period when opening snapshot creation fails', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.failOpeningBalanceSnapshotCreate = true;

    const response = await context.request('/accounting-periods', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        month: '2026-03',
        initializeOpeningBalance: true,
        openingBalanceLines: [
          {
            accountSubjectId: 'as-1-1010',
            fundingAccountId: 'acc-1',
            balanceAmount: 3000000
          },
          {
            accountSubjectId: 'as-1-3100',
            balanceAmount: 3000000
          }
        ],
        note: '2026년 3월 운영 시작'
      }
    });

    assert.equal(response.status, 500);
    assert.equal(context.state.accountingPeriods.length, 0);
    assert.equal(context.state.openingBalanceSnapshots.length, 0);
    assert.equal(context.state.periodStatusHistory.length, 0);
  } finally {
    await context.close();
  }
});

test('GET /accounting-periods/current returns the currently open period for the active ledger', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-current-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-current-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-current-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });

    const response = await context.request('/accounting-periods/current', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'period-current-1',
      year: 2026,
      month: 3,
      monthLabel: '2026-03',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      status: AccountingPeriodStatus.OPEN,
      openedAt: '2026-03-01T00:00:00.000Z',
      lockedAt: null,
      hasOpeningBalanceSnapshot: false,
      openingBalanceSourceKind: null,
      statusHistory: [
        {
          id: 'period-history-current-1',
          fromStatus: null,
          toStatus: AccountingPeriodStatus.OPEN,
          eventType: 'OPEN',
          reason: '3월 운영 시작',
          actorType: AuditActorType.TENANT_MEMBERSHIP,
          actorMembershipId: 'membership-1',
          changedAt: '2026-03-01T00:00:00.000Z'
        }
      ]
    });
  } finally {
    await context.close();
  }
});

test('GET /accounting-periods/current returns the latest collecting period when multiple periods are open', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-current-multi-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-03-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-current-multi-2',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.IN_REVIEW,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z')
      }
    );

    const response = await context.request('/accounting-periods/current', {
      headers: context.authHeaders()
    });
    const body = response.body as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(body.id, 'period-current-multi-2');
    assert.equal(body.monthLabel, '2026-04');
    assert.equal(body.status, AccountingPeriodStatus.IN_REVIEW);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/close locks the period and creates a closing snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-close-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '3월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-close-1',
      sourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'opening-close-line-1',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-close-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_000_000
      },
      {
        id: 'opening-close-line-2',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-close-1',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_000_000
      }
    );
    context.state.journalEntries.push({
      id: 'je-close-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-1',
      entryNumber: '202603-0001',
      entryDate: new Date('2026-03-12T00:00:00.000Z'),
      sourceKind: 'COLLECTED_TRANSACTION',
      sourceCollectedTransactionId: 'ctx-seed-2',
      status: 'POSTED',
      memo: 'Fuel refill',
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1',
      createdAt: new Date('2026-03-12T01:00:00.000Z'),
      updatedAt: new Date('2026-03-12T01:00:00.000Z'),
      lines: [
        {
          id: 'jel-close-1',
          lineNumber: 1,
          accountSubjectId: 'as-1-5100',
          fundingAccountId: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: 'Fuel refill'
        },
        {
          id: 'jel-close-2',
          lineNumber: 2,
          accountSubjectId: 'as-1-1010',
          fundingAccountId: 'acc-1',
          debitAmount: 0,
          creditAmount: 84_000,
          description: 'Fuel refill'
        }
      ]
    });

    const response = await context.request(
      '/accounting-periods/period-close-1/close',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          note: '3월 월마감'
        }
      }
    );

    const body = response.body as CloseAccountingPeriodResponse;
    const closingLines = context.state.balanceSnapshotLines.filter(
      (line) => line.snapshotKind === 'CLOSING'
    );

    assert.equal(response.status, 201);
    assert.equal(body.period.status, AccountingPeriodStatus.LOCKED);
    assert.equal(context.state.closingSnapshots.length, 1);
    assert.equal(closingLines.length, 3);
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.toStatus,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(body.closingSnapshot.totalAssetAmount, 2_916_000);
    assert.equal(body.closingSnapshot.totalLiabilityAmount, 0);
    assert.equal(body.closingSnapshot.totalEquityAmount, 2_916_000);
    assert.equal(body.closingSnapshot.periodPnLAmount, -84_000);
    assert.equal(body.closingSnapshot.lines.length, 3);
    assert.deepEqual(
      body.closingSnapshot.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        fundingAccountName: line.fundingAccountName,
        balanceAmount: line.balanceAmount
      })),
      [
        {
          accountSubjectCode: '1010',
          fundingAccountName: 'Main checking',
          balanceAmount: 2_916_000
        },
        {
          accountSubjectCode: '3100',
          fundingAccountName: null,
          balanceAmount: 3_000_000
        },
        {
          accountSubjectCode: '5100',
          fundingAccountName: null,
          balanceAmount: 84_000
        }
      ]
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.close' &&
          candidate.details.periodId === 'period-close-1' &&
          candidate.details.closingSnapshotId === body.closingSnapshot.id
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/close blocks locking when unresolved collected transactions remain', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-close-pending-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-pending-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-pending-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-pending-1',
      title: '미확정 주유',
      occurredOn: new Date('2026-03-13T00:00:00.000Z'),
      amount: 84_000,
      status: CollectedTransactionStatus.REVIEWED,
      memo: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-pending-other-period',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-other',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-pending-other-period',
      title: 'Pending in another period',
      occurredOn: new Date('2026-04-01T00:00:00.000Z'),
      amount: 12_000,
      status: CollectedTransactionStatus.READY_TO_POST,
      memo: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.collectedTransactions.push({
      id: 'ctx-close-posted-same-period',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-close-pending-1',
      ledgerTransactionTypeId: 'ltt-1-expense',
      fundingAccountId: 'acc-1',
      categoryId: 'cat-1',
      matchedPlanItemId: null,
      importBatchId: null,
      importedRowId: null,
      sourceFingerprint: 'close-posted-same-period',
      title: 'Posted in same period',
      occurredOn: new Date('2026-03-14T00:00:00.000Z'),
      amount: 25_000,
      status: CollectedTransactionStatus.POSTED,
      memo: null,
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z')
    });

    const response = await context.request(
      '/accounting-periods/period-close-pending-1/close',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          note: '미확정 거래가 있는 상태에서 월마감 시도'
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '미확정 수집 거래 1건이 남아 있어 운영 기간을 잠글 수 없습니다.',
      error: 'Bad Request'
    });
    assert.equal(context.state.closingSnapshots.length, 0);
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-close-pending-1'
      )?.status,
      AccountingPeriodStatus.OPEN
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen reopens the latest locked period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-reopen-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-reopen-open-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '3월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-history-reopen-lock-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '3월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-31T15:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-reopen-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: 140_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 140_000,
      periodPnLAmount: 140_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push({
      id: 'closing-reopen-line-1',
      snapshotKind: 'CLOSING',
      openingSnapshotId: null,
      closingSnapshotId: 'closing-reopen-1',
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: 140_000
    });
    context.state.financialStatementSnapshots.push(
      {
        id: 'financial-reopen-bs',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
        currency: 'KRW',
        payload: {
          summary: [{ label: '자산 총계', amountWon: 140_000 }],
          sections: [],
          notes: []
        } as FinancialStatementPayload,
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      },
      {
        id: 'financial-reopen-pl',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-1',
        statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
        currency: 'KRW',
        payload: {
          summary: [{ label: '당기 손익', amountWon: 140_000 }],
          sections: [],
          notes: []
        } as FinancialStatementPayload,
        createdAt: new Date('2026-03-31T15:10:00.000Z'),
        updatedAt: new Date('2026-03-31T15:10:00.000Z')
      }
    );

    const response = await context.request(
      '/accounting-periods/period-reopen-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '재무제표 재산출 필요'
        }
      }
    );

    const body = response.body as Record<string, unknown>;

    assert.equal(response.status, 201);
    assert.equal(body.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.lockedAt, null);
    assert.equal(context.state.closingSnapshots.length, 0);
    assert.equal(context.state.balanceSnapshotLines.length, 0);
    assert.equal(context.state.financialStatementSnapshots.length, 0);
    assert.equal(
      context.state.accountingPeriods.find(
        (item) => item.id === 'period-reopen-1'
      )?.status,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(
      context.state.accountingPeriods.find(
        (item) => item.id === 'period-reopen-1'
      )?.lockedAt,
      null
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.toStatus,
      AccountingPeriodStatus.OPEN
    );
    assert.equal(context.state.periodStatusHistory.at(-1)?.eventType, 'REOPEN');
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.reason,
      '재무제표 재산출 필요'
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.actorMembershipId,
      'membership-1'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.reopen' &&
          candidate.details.periodId === 'period-reopen-1' &&
          candidate.details.reason === '재무제표 재산출 필요'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen blocks reopening when a later operating month exists', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-reopen-older-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-03-01T00:00:00.000Z'),
        lockedAt: new Date('2026-03-31T15:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T15:00:00.000Z')
      },
      {
        id: 'period-reopen-older-next',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    );

    const response = await context.request(
      '/accounting-periods/period-reopen-older-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '과거 월 재오픈 시도'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '최근 운영 월 2026-04이 이미 존재해 2026-03은 재오픈할 수 없습니다. 운영 중에는 하나의 최신 진행월만 열어 둡니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-older-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen blocks reopening when carry-forward outputs already exist', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-reopen-blocked-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 3,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-03-01T00:00:00.000Z'),
        lockedAt: new Date('2026-03-31T15:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T15:00:00.000Z')
      },
      {
        id: 'period-reopen-blocked-next',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 4,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-reopen-blocked-open-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-blocked-1',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '3월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        id: 'period-history-reopen-blocked-lock-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-reopen-blocked-1',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '3월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-03-31T15:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-blocked-1',
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      totalAssetAmount: 140_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 140_000,
      periodPnLAmount: 140_000,
      createdAt: new Date('2026-03-31T15:00:00.000Z')
    });
    context.state.financialStatementSnapshots.push({
      id: 'financial-reopen-blocked-bs',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-reopen-blocked-1',
      statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      currency: 'KRW',
      payload: {
        summary: [{ label: '자산 총계', amountWon: 140_000 }],
        sections: [],
        notes: []
      } as FinancialStatementPayload,
      createdAt: new Date('2026-03-31T15:10:00.000Z'),
      updatedAt: new Date('2026-03-31T15:10:00.000Z')
    });
    context.state.openingBalanceSnapshots.push({
      id: 'opening-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-reopen-blocked-next',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-forward-reopen-blocked-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-reopen-blocked-1',
      toPeriodId: 'period-reopen-blocked-next',
      sourceClosingSnapshotId: 'closing-reopen-blocked-1',
      createdJournalEntryId: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });

    const response = await context.request(
      '/accounting-periods/period-reopen-blocked-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '차기 이월 이후 재오픈 시도'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message: '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-blocked-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(context.state.closingSnapshots.length, 1);
    assert.equal(context.state.financialStatementSnapshots.length, 1);
    assert.equal(context.state.carryForwardRecords.length, 1);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen returns 400 when the reopen reason is blank after trimming', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-reopen-blank-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });

    const initialHistoryCount = context.state.periodStatusHistory.length;
    const response = await context.request(
      '/accounting-periods/period-reopen-blank-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '   '
        }
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      statusCode: 400,
      message: '재오픈 사유를 입력해 주세요.',
      error: 'Bad Request'
    });
    assert.equal(
      context.state.accountingPeriods.find(
        (candidate) => candidate.id === 'period-reopen-blank-1'
      )?.status,
      AccountingPeriodStatus.LOCKED
    );
    assert.equal(context.state.periodStatusHistory.length, initialHistoryCount);
  } finally {
    await context.close();
  }
});

test('POST /accounting-periods/:id/reopen returns 403 when the current membership role cannot reopen', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships[0]!.role = 'MANAGER';
    context.state.accountingPeriods.push({
      id: 'period-reopen-denied-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 3,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-04-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-03-01T00:00:00.000Z'),
      lockedAt: new Date('2026-03-31T15:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z')
    });

    const response = await context.request(
      '/accounting-periods/period-reopen-denied-1/reopen',
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '재오픈 사유 확인 필요'
        }
      }
    );

    assert.equal(response.status, 403);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'authorization.action_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'accounting_period.reopen' &&
          candidate.details.periodId === 'period-reopen-denied-1' &&
          candidate.details.membershipRole === 'MANAGER'
      )
    );
  } finally {
    await context.close();
  }
});
