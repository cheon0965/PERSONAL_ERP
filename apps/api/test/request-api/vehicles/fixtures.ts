import { AccountingPeriodStatus } from '@prisma/client';
import { createRequestTestContext } from '../../support/request-api/index';

export type RequestContext = Awaited<
  ReturnType<typeof createRequestTestContext>
>;

export function addOpenMarchVehicleAccountingPeriod(
  context: RequestContext
): void {
  const timestamp = new Date('2026-03-01T00:00:00.000Z');

  context.state.accountingPeriods.push({
    id: 'period-open-vehicle-logs',
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    year: 2026,
    month: 3,
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-04-01T00:00:00.000Z'),
    status: AccountingPeriodStatus.OPEN,
    openedAt: timestamp,
    lockedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}
