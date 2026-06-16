import {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

export type RequestContext = Awaited<
  ReturnType<typeof createRequestTestContext>
>;

export function seedCancelableCarryForwardFixture(
  context: RequestContext,
  input: {
    prefix: string;
    sourceYear?: number;
    sourceMonth?: number;
    closingAmount?: number;
    openingAmount?: number;
  }
) {
  const sourceYear = input.sourceYear ?? 2026;
  const sourceMonth = input.sourceMonth ?? 7;
  const targetYear = sourceMonth === 12 ? sourceYear + 1 : sourceYear;
  const targetMonth = sourceMonth === 12 ? 1 : sourceMonth + 1;
  const closingAmount = input.closingAmount ?? 1_250_000;
  const openingAmount = input.openingAmount ?? 900_000;
  const sourcePeriodId = `${input.prefix}-source`;
  const targetPeriodId = `${input.prefix}-target`;
  const closingSnapshotId = `${input.prefix}-closing`;
  const openingSnapshotId = `${input.prefix}-opening`;
  const carryForwardRecordId = `${input.prefix}-record`;

  context.state.accountingPeriods.push(
    {
      id: sourcePeriodId,
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: sourceYear,
      month: sourceMonth,
      startDate: new Date(
        `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      endDate: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      status: AccountingPeriodStatus.LOCKED,
      openedAt: new Date(
        `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      lockedAt: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      createdAt: new Date(
        `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      updatedAt: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      )
    },
    {
      id: targetPeriodId,
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      year: targetYear,
      month: targetMonth,
      startDate: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      endDate: new Date(
        targetMonth === 12
          ? `${targetYear + 1}-01-01T00:00:00.000Z`
          : `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      status: AccountingPeriodStatus.OPEN,
      openedAt: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      lockedAt: null,
      createdAt: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      ),
      updatedAt: new Date(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00.000Z`
      )
    }
  );

  context.state.closingSnapshots.push({
    id: closingSnapshotId,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: sourcePeriodId,
    lockedAt: new Date(),
    totalAssetAmount: closingAmount,
    totalLiabilityAmount: 0,
    totalEquityAmount: closingAmount,
    periodPnLAmount: 0,
    createdAt: new Date()
  });
  context.state.openingBalanceSnapshots.push({
    id: openingSnapshotId,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    effectivePeriodId: targetPeriodId,
    sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
    createdAt: new Date(),
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1'
  });
  context.state.balanceSnapshotLines.push(
    {
      id: `${input.prefix}-closing-asset`,
      snapshotKind: 'CLOSING',
      openingSnapshotId: null,
      closingSnapshotId,
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: closingAmount
    },
    {
      id: `${input.prefix}-closing-equity`,
      snapshotKind: 'CLOSING',
      openingSnapshotId: null,
      closingSnapshotId,
      accountSubjectId: 'as-1-3100',
      fundingAccountId: null,
      balanceAmount: closingAmount
    },
    {
      id: `${input.prefix}-opening-asset`,
      snapshotKind: 'OPENING',
      openingSnapshotId,
      closingSnapshotId: null,
      accountSubjectId: 'as-1-1010',
      fundingAccountId: 'acc-1',
      balanceAmount: openingAmount
    },
    {
      id: `${input.prefix}-opening-equity`,
      snapshotKind: 'OPENING',
      openingSnapshotId,
      closingSnapshotId: null,
      accountSubjectId: 'as-1-3100',
      fundingAccountId: null,
      balanceAmount: openingAmount
    }
  );
  context.state.carryForwardRecords.push({
    id: carryForwardRecordId,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    fromPeriodId: sourcePeriodId,
    toPeriodId: targetPeriodId,
    sourceClosingSnapshotId: closingSnapshotId,
    createdJournalEntryId: null,
    createdAt: new Date(),
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1'
  });

  return {
    sourcePeriodId,
    targetPeriodId,
    closingSnapshotId,
    openingSnapshotId,
    carryForwardRecordId
  };
}
