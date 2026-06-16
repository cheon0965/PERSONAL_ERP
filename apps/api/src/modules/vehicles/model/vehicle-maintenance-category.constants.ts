import type { VehicleMaintenanceCategory } from '@personal-erp/contracts/assets';

export const vehicleMaintenanceCategoryValues = [
  'INSPECTION',
  'REPAIR',
  'CONSUMABLE',
  'TIRE',
  'ACCIDENT',
  'OTHER'
] as const satisfies readonly VehicleMaintenanceCategory[];
