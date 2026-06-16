import { createVehicleFuelLogsPrismaMock } from './vehicle-fuel-logs';
import { createVehicleMaintenanceLogsPrismaMock } from './vehicle-maintenance-logs';
import { createVehicleRecordsPrismaMock } from './vehicle-records';
import type { RequestPrismaMockContext } from './shared';

export function createVehiclesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  return {
    ...createVehicleRecordsPrismaMock(context),
    ...createVehicleFuelLogsPrismaMock(context),
    ...createVehicleMaintenanceLogsPrismaMock(context)
  };
}
