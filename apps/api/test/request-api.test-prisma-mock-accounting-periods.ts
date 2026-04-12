import { createAccountingPeriodSnapshotsPrismaMock } from './request-api.test-prisma-mock-accounting-period-snapshots';
import { createAccountingPeriodStatePrismaMock } from './request-api.test-prisma-mock-accounting-period-state';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAccountingPeriodsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createAccountingPeriodStatePrismaMock(context),
    ...createAccountingPeriodSnapshotsPrismaMock(context)
  };
}
