import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CancelCarryForwardResponse,
  CarryForwardView
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';
import { seedCancelableCarryForwardFixture } from './fixtures';

test('POST /carry-forwards/generate creates a carry forward record and the next opening snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push({
      id: 'period-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: 2026,
      month: 4,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-05-01T00:00:00.000Z'),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-open-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: 'OPEN',
      reason: '4월 운영 시작',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-01T00:00:00.000Z')
    });
    context.state.periodStatusHistory.push({
      id: 'period-history-carry-lock-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      fromStatus: AccountingPeriodStatus.OPEN,
      toStatus: AccountingPeriodStatus.LOCKED,
      eventType: 'LOCK',
      reason: '4월 마감',
      actorType: AuditActorType.TENANT_MEMBERSHIP,
      actorMembershipId: 'membership-1',
      changedAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.closingSnapshots.push({
      id: 'closing-carry-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-1',
      lockedAt: new Date('2026-04-30T15:00:00.000Z'),
      totalAssetAmount: 2_916_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 2_916_000,
      periodPnLAmount: -84_000,
      createdAt: new Date('2026-04-30T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-balance-1',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 2_916_000
      },
      {
        id: 'carry-balance-2',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_000_000
      },
      {
        id: 'carry-balance-3',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-1',
        accountSubjectId: 'as-1-5100',
        fundingAccountId: null,
        balanceAmount: 84_000
      }
    );

    const response = await context.request('/carry-forwards/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        fromPeriodId: 'period-carry-1'
      }
    });

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 201);
    assert.equal(context.state.carryForwardRecords.length, 1);
    assert.equal(body.sourcePeriod.id, 'period-carry-1');
    assert.equal(body.targetPeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.status, AccountingPeriodStatus.OPEN);
    assert.equal(body.carryForwardRecord.createdJournalEntryId, null);
    assert.equal(
      context.state.journalEntries.filter(
        (entry) => entry.sourceKind === 'CARRY_FORWARD'
      ).length,
      0
    );
    assert.equal(body.targetOpeningBalanceSnapshot.sourceKind, 'CARRY_FORWARD');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 2);
    assert.deepEqual(
      body.targetOpeningBalanceSnapshot.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        balanceAmount: line.balanceAmount
      })),
      [
        {
          accountSubjectCode: '1010',
          balanceAmount: 2_916_000
        },
        {
          accountSubjectCode: '3100',
          balanceAmount: 3_000_000
        }
      ]
    );
    assert.equal(
      context.state.periodStatusHistory.at(-1)?.actorMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.openingBalanceSnapshots.at(-1)?.createdByActorType,
      AuditActorType.TENANT_MEMBERSHIP
    );
    assert.equal(
      context.state.openingBalanceSnapshots.at(-1)?.createdByMembershipId,
      'membership-1'
    );
    assert.equal(
      context.state.carryForwardRecords[0]?.createdByActorType,
      AuditActorType.TENANT_MEMBERSHIP
    );
    assert.equal(
      context.state.carryForwardRecords[0]?.createdByMembershipId,
      'membership-1'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.action === 'carry_forward.generate' &&
          candidate.details.fromPeriodId === 'period-carry-1' &&
          candidate.details.toPeriodId === body.targetPeriod.id &&
          candidate.details.carryForwardRecordId === body.carryForwardRecord.id
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /carry-forwards/:id/cancel removes an unused carry forward opening snapshot', async () => {
  const context = await createRequestTestContext();

  try {
    const fixture = seedCancelableCarryForwardFixture(context, {
      prefix: 'carry-cancel'
    });

    const response = await context.request(
      `/carry-forwards/${fixture.carryForwardRecordId}/cancel`,
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '마감 정정 준비'
        }
      }
    );

    const body = response.body as CancelCarryForwardResponse;

    assert.equal(response.status, 201);
    assert.equal(body.carryForwardRecord.id, fixture.carryForwardRecordId);
    assert.equal(body.carryForwardRecord.createdJournalEntryId, null);
    assert.equal(body.sourcePeriod.id, fixture.sourcePeriodId);
    assert.equal(body.targetPeriod.id, fixture.targetPeriodId);
    assert.equal(body.targetPeriod.hasOpeningBalanceSnapshot, false);
    assert.equal(
      body.canceledOpeningBalanceSnapshotId,
      fixture.openingSnapshotId
    );
    assert.equal(
      context.state.carryForwardRecords.some(
        (candidate) => candidate.id === fixture.carryForwardRecordId
      ),
      false
    );
    assert.equal(
      context.state.openingBalanceSnapshots.some(
        (candidate) => candidate.id === fixture.openingSnapshotId
      ),
      false
    );
    assert.equal(
      context.state.balanceSnapshotLines.some(
        (candidate) => candidate.openingSnapshotId === fixture.openingSnapshotId
      ),
      false
    );
    assert.equal(
      context.state.journalEntries.some(
        (candidate) => candidate.sourceKind === 'CARRY_FORWARD'
      ),
      false
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.action === 'carry_forward.cancel' &&
          candidate.details.carryForwardRecordId ===
            fixture.carryForwardRecordId
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /carry-forwards/:id/cancel blocks cancellation after target period outputs exist', async () => {
  const context = await createRequestTestContext();

  try {
    const fixture = seedCancelableCarryForwardFixture(context, {
      prefix: 'carry-cancel-blocked'
    });
    context.state.closingSnapshots.push({
      id: 'carry-cancel-blocked-target-closing',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: fixture.targetPeriodId,
      lockedAt: new Date(),
      totalAssetAmount: 1_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 1_000,
      periodPnLAmount: 0,
      createdAt: new Date()
    });

    const response = await context.request(
      `/carry-forwards/${fixture.carryForwardRecordId}/cancel`,
      {
        method: 'POST',
        headers: context.authHeaders(),
        body: {
          reason: '이미 다음 월 산출물 존재'
        }
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      statusCode: 409,
      message:
        '다음 운영 기간에 거래, 업로드, 전표, 마감 산출물이 있어 차기 이월을 취소할 수 없습니다.',
      error: 'Conflict'
    });
    assert.equal(
      context.state.carryForwardRecords.some(
        (candidate) => candidate.id === fixture.carryForwardRecordId
      ),
      true
    );
    assert.equal(
      context.state.openingBalanceSnapshots.some(
        (candidate) => candidate.id === fixture.openingSnapshotId
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /carry-forwards/generate can safely replace an existing carry forward', async () => {
  const context = await createRequestTestContext();

  try {
    const fixture = seedCancelableCarryForwardFixture(context, {
      prefix: 'carry-regenerate',
      sourceMonth: 9,
      closingAmount: 2_500_000,
      openingAmount: 900_000
    });

    const response = await context.request('/carry-forwards/generate', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        fromPeriodId: fixture.sourcePeriodId,
        replaceExisting: true,
        replaceReason: '테스트 재생성'
      }
    });

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 201);
    assert.equal(body.sourcePeriod.id, fixture.sourcePeriodId);
    assert.equal(body.targetPeriod.id, fixture.targetPeriodId);
    assert.notEqual(body.carryForwardRecord.id, fixture.carryForwardRecordId);
    assert.equal(
      context.state.carryForwardRecords.filter(
        (candidate) => candidate.fromPeriodId === fixture.sourcePeriodId
      ).length,
      1
    );
    assert.equal(
      context.state.openingBalanceSnapshots.filter(
        (candidate) => candidate.effectivePeriodId === fixture.targetPeriodId
      ).length,
      1
    );
    assert.deepEqual(
      body.targetOpeningBalanceSnapshot.lines.map((line) => ({
        accountSubjectCode: line.accountSubjectCode,
        balanceAmount: line.balanceAmount
      })),
      [
        {
          accountSubjectCode: '1010',
          balanceAmount: 2_500_000
        },
        {
          accountSubjectCode: '3100',
          balanceAmount: 2_500_000
        }
      ]
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'audit.action_succeeded' &&
          candidate.details.action === 'carry_forward.generate' &&
          candidate.details.replaceExisting === true
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /carry-forwards returns the stored carry forward view for the selected source period', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.accountingPeriods.push(
      {
        id: 'period-carry-view-source',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 5,
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-06-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.LOCKED,
        openedAt: new Date('2026-05-01T00:00:00.000Z'),
        lockedAt: new Date('2026-05-31T15:00:00.000Z'),
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-carry-view-target',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        year: 2026,
        month: 6,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-07-01T00:00:00.000Z'),
        status: AccountingPeriodStatus.OPEN,
        openedAt: new Date('2026-06-01T00:00:00.000Z'),
        lockedAt: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.periodStatusHistory.push(
      {
        id: 'period-history-carry-view-source-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '5월 운영 시작',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-01T00:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-source-lock',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-source',
        fromStatus: AccountingPeriodStatus.OPEN,
        toStatus: AccountingPeriodStatus.LOCKED,
        eventType: 'LOCK',
        reason: '5월 마감',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-05-31T15:00:00.000Z')
      },
      {
        id: 'period-history-carry-view-target-open',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-carry-view-target',
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        eventType: 'OPEN',
        reason: '5월 이월 생성',
        actorType: AuditActorType.TENANT_MEMBERSHIP,
        actorMembershipId: 'membership-1',
        changedAt: new Date('2026-06-01T00:00:00.000Z')
      }
    );
    context.state.closingSnapshots.push({
      id: 'closing-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      periodId: 'period-carry-view-source',
      lockedAt: new Date('2026-05-31T15:00:00.000Z'),
      totalAssetAmount: 3_120_000,
      totalLiabilityAmount: 0,
      totalEquityAmount: 3_120_000,
      periodPnLAmount: 120_000,
      createdAt: new Date('2026-05-31T15:00:00.000Z')
    });
    context.state.balanceSnapshotLines.push(
      {
        id: 'carry-view-closing-line',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-view',
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-closing-equity-line',
        snapshotKind: 'CLOSING',
        openingSnapshotId: null,
        closingSnapshotId: 'closing-carry-view',
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-opening-line',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-carry-view',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-1010',
        fundingAccountId: 'acc-1',
        balanceAmount: 3_120_000
      },
      {
        id: 'carry-view-opening-equity-line',
        snapshotKind: 'OPENING',
        openingSnapshotId: 'opening-carry-view',
        closingSnapshotId: null,
        accountSubjectId: 'as-1-3100',
        fundingAccountId: null,
        balanceAmount: 3_120_000
      }
    );
    context.state.openingBalanceSnapshots.push({
      id: 'opening-carry-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      effectivePeriodId: 'period-carry-view-target',
      sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });
    context.state.carryForwardRecords.push({
      id: 'carry-record-view',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      fromPeriodId: 'period-carry-view-source',
      toPeriodId: 'period-carry-view-target',
      sourceClosingSnapshotId: 'closing-carry-view',
      createdJournalEntryId: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
      createdByMembershipId: 'membership-1'
    });

    const response = await context.request(
      '/carry-forwards?fromPeriodId=period-carry-view-source',
      {
        headers: context.authHeaders()
      }
    );

    const body = response.body as CarryForwardView;

    assert.equal(response.status, 200);
    assert.equal(body.carryForwardRecord.id, 'carry-record-view');
    assert.equal(body.sourcePeriod.monthLabel, '2026-05');
    assert.equal(body.targetPeriod.monthLabel, '2026-06');
    assert.equal(body.targetOpeningBalanceSnapshot.lines.length, 2);
    assert.deepEqual(
      body.targetOpeningBalanceSnapshot.lines.map(
        (line) => line.accountSubjectCode
      ),
      ['1010', '3100']
    );
  } finally {
    await context.close();
  }
});
