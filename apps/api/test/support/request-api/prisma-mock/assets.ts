import { createInsurancePoliciesPrismaMock } from './insurance-policies';
import type { RequestPrismaMockContext } from './shared';
import { createVehiclesPrismaMock } from './vehicles';

export function createAssetsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createInsurancePoliciesPrismaMock(context),
    ...createVehiclesPrismaMock(context)
  };
}
