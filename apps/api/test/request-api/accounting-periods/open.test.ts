import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

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
