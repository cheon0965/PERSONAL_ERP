import { createAccountingPeriodSnapshotsPrismaMock } from './accounting-period-snapshots';
import { createAccountingPeriodStatePrismaMock } from './accounting-period-state';
import type { RequestPrismaMockContext } from './shared';

export function createAccountingPeriodsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createAccountingPeriodStatePrismaMock(context),
    ...createAccountingPeriodSnapshotsPrismaMock(context)
  };
}
