import { createVehicleFuelLogsPrismaMock } from './request-api.test-prisma-mock-vehicle-fuel-logs';
import { createVehicleMaintenanceLogsPrismaMock } from './request-api.test-prisma-mock-vehicle-maintenance-logs';
import { createVehicleRecordsPrismaMock } from './request-api.test-prisma-mock-vehicle-records';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createVehiclesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createVehicleRecordsPrismaMock(context),
    ...createVehicleFuelLogsPrismaMock(context),
    ...createVehicleMaintenanceLogsPrismaMock(context)
  };
}
