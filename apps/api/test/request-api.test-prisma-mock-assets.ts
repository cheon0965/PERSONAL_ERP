import { createInsurancePoliciesPrismaMock } from './request-api.test-prisma-mock-insurance-policies';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';
import { createVehiclesPrismaMock } from './request-api.test-prisma-mock-vehicles';

export function createAssetsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createInsurancePoliciesPrismaMock(context),
    ...createVehiclesPrismaMock(context)
  };
}
