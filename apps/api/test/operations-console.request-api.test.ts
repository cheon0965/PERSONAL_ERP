import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  PlanItemStatus
} from '@prisma/client';
import { createRequestTestContext } from './request-api.test-support';

test('GET /operations/summary returns the operations hub read model', async () => {
  const context = await createRequestTestContext();

  try {
    seedOperationsConsoleState(context);

    const response = await context.request('/operations/summary', {
      headers: context.authHeaders()
    });
    const summary = response.body as Record<string, unknown>;
    const exceptions = summary.exceptions as Record<string, unknown>;
    const monthEnd = summary.monthEnd as Record<string, unknown>;
    const imports = summary.imports as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(monthEnd.unresolvedTransactionCount, 1);
    assert.equal(monthEnd.failedImportRowCount, 1);
    assert.equal(imports.uncollectedRowCount, 1);
    assert.equal(exceptions.totalCount, 5);
    assert.equal('rawPayload' in imports, false);
  } finally {
    await context.close();
  }
});

test('GET/POST /operations/* endpoints expose monitoring, exports, and notes', async () => {
  const context = await createRequestTestContext();

  try {
    seedOperationsConsoleState(context);

    const [
      checklist,
      exceptions,
      monthEnd,
      imports,
      systemStatus,
      alerts,
      exports,
      notes
    ] = await Promise.all([
      context.request('/operations/checklist', {
        headers: context.authHeaders()
      }),
      context.request('/operations/exceptions', {
        headers: context.authHeaders()
      }),
      context.request('/operations/month-end', {
        headers: context.authHeaders()
      }),
      context.request('/operations/import-status', {
        headers: context.authHeaders()
      }),
      context.request('/operations/system-status', {
        headers: context.authHeaders()
      }),
      context.request('/operations/alerts', {
        headers: context.authHeaders()
      }),
      context.request('/operations/exports', {
        headers: context.authHeaders()
      }),
      context.request('/operations/notes', {
        headers: context.authHeaders()
      })
    ]);
    const exportResult = await context.request('/operations/exports', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        scope: 'COLLECTED_TRANSACTIONS',
        periodId: 'period-operations-open-1'
      }
    });
    const createdNote = await context.request('/operations/notes', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        kind: 'MONTH_END',
        title: '3월 마감 인수인계',
        body: '업로드 실패 행 1건과 미확정 거래 1건을 다음 담당자가 확인해야 합니다.',
        relatedHref: '/operations/alerts',
        periodId: 'period-operations-open-1'
      }
    });

    assert.equal(checklist.status, 200);
    assert.equal(exceptions.status, 200);
    assert.equal(monthEnd.status, 200);
    assert.equal(imports.status, 200);
    assert.equal(systemStatus.status, 200);
    assert.equal(alerts.status, 200);
    assert.equal(exports.status, 200);
    assert.equal(notes.status, 200);
    assert.equal(exportResult.status, 201);
    assert.equal(createdNote.status, 201);
    assert.equal(
      Array.isArray((checklist.body as Record<string, unknown>).groups),
      true
    );
    assert.equal(
      Array.isArray((exceptions.body as Record<string, unknown>).items),
      true
    );
    assert.equal(
      (monthEnd.body as Record<string, unknown>).closeReadiness,
      'BLOCKED'
    );
    assert.equal(
      (imports.body as Record<string, unknown>).uncollectedRowCount,
      1
    );
    assert.equal(
      (systemStatus.body as Record<string, unknown>).overallStatus,
      'DEGRADED'
    );
    assert.equal((alerts.body as Record<string, unknown>).totalCount, 7);
    assert.equal(
      Array.isArray((exports.body as Record<string, unknown>).items),
      true
    );
    assert.equal((notes.body as Record<string, unknown>).totalCount, 0);
    assert.equal((exportResult.body as Record<string, unknown>).rowCount, 1);
    assert.match(
      String((exportResult.body as Record<string, unknown>).payload),
      /Review needed/
    );
    assert.equal(
      (createdNote.body as Record<string, unknown>).periodLabel,
      '2026-03'
    );
    assert.equal(context.state.workspaceOperationalNotes.length, 1);
  } finally {
    await context.close();
  }
});

function seedOperationsConsoleState(
  context: Awaited<ReturnType<typeof createRequestTestContext>>
) {
  context.state.accountingPeriods.push({
    id: 'period-operations-open-1',
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
  context.state.openingBalanceSnapshots.push({
    id: 'opening-operations-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    effectivePeriodId: 'period-operations-open-1',
    sourceKind: 'INITIAL_SETUP',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1'
  });
  context.state.collectedTransactions.push({
    id: 'ctx-operations-review-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-operations-open-1',
    ledgerTransactionTypeId: 'ltt-1-expense',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    matchedPlanItemId: null,
    importBatchId: null,
    importedRowId: null,
    sourceFingerprint: null,
    title: 'Review needed',
    occurredOn: new Date('2026-03-24T00:00:00.000Z'),
    amount: 10_000,
    status: CollectedTransactionStatus.REVIEWED,
    memo: null,
    createdAt: new Date('2026-03-24T01:00:00.000Z'),
    updatedAt: new Date('2026-03-24T01:00:00.000Z')
  });
  context.state.planItems.push({
    id: 'plan-operations-open-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-operations-open-1',
    recurringRuleId: null,
    ledgerTransactionTypeId: 'ltt-1-expense',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    title: 'Remaining plan',
    plannedAmount: 30_000,
    plannedDate: new Date('2026-03-28T00:00:00.000Z'),
    status: PlanItemStatus.DRAFT,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z')
  });
  context.state.importBatches.push({
    id: 'import-operations-1',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-operations-open-1',
    sourceKind: ImportSourceKind.BANK_CSV,
    fileName: 'operations-import.csv',
    fileHash: 'hash-operations-1',
    fundingAccountId: null,
    rowCount: 2,
    parseStatus: ImportBatchParseStatus.PARTIAL,
    uploadedByMembershipId: 'membership-1',
    uploadedAt: new Date('2026-03-24T09:00:00.000Z')
  });
  context.state.importedRows.push(
    {
      id: 'import-row-operations-1',
      batchId: 'import-operations-1',
      rowNumber: 2,
      rawPayload: {
        title: 'Needs collection'
      },
      parseStatus: ImportedRowParseStatus.PARSED,
      parseError: null,
      sourceFingerprint: 'sf:operations:1'
    },
    {
      id: 'import-row-operations-2',
      batchId: 'import-operations-1',
      rowNumber: 3,
      rawPayload: {
        title: 'Broken row'
      },
      parseStatus: ImportedRowParseStatus.FAILED,
      parseError: 'invalid date',
      sourceFingerprint: null
    }
  );
  context.state.workspaceAuditEvents.push(
    {
      id: 'audit-operations-success-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      actorUserId: 'user-1',
      actorMembershipId: 'membership-1',
      actorRole: 'OWNER',
      eventCategory: 'import_batch',
      eventName: 'audit.action_succeeded',
      action: 'import_batch.upload',
      resourceType: 'import_batch',
      resourceId: 'import-operations-1',
      result: 'SUCCESS',
      reason: null,
      requestId: 'request-operations-success',
      path: '/import-batches',
      clientIpHash: null,
      metadata: null,
      occurredAt: new Date('2026-03-24T09:00:00.000Z')
    },
    {
      id: 'audit-operations-denied-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      actorUserId: 'user-1',
      actorMembershipId: 'membership-1',
      actorRole: 'VIEWER',
      eventCategory: 'admin_member',
      eventName: 'authorization.action_denied',
      action: 'admin_member.update_role',
      resourceType: 'tenant_membership',
      resourceId: 'membership-2',
      result: 'DENIED',
      reason: 'insufficient_membership_role',
      requestId: 'request-operations-denied',
      path: '/admin/members/membership-2/role',
      clientIpHash: null,
      metadata: null,
      occurredAt: new Date('2026-03-24T10:00:00.000Z')
    },
    {
      id: 'audit-operations-failed-1',
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      actorUserId: 'user-1',
      actorMembershipId: 'membership-1',
      actorRole: 'OWNER',
      eventCategory: 'admin_member',
      eventName: 'admin.member_invitation_email_failed',
      action: 'admin_member.invite',
      resourceType: 'tenant_membership_invitation',
      resourceId: 'invitation-1',
      result: 'FAILED',
      reason: 'email_send_failed',
      requestId: 'request-operations-failed',
      path: '/admin/members/invitations',
      clientIpHash: null,
      metadata: null,
      occurredAt: new Date('2026-03-24T11:00:00.000Z')
    }
  );
}
