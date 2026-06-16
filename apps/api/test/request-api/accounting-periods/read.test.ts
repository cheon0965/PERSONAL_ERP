import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

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
