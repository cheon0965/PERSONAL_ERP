import type {
  VehicleItem,
  VehicleFuelLogItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';

type DecimalLike = number | string | { toString(): string };

type VehicleFuelLogRecord = Omit<
  VehicleFuelLogItem,
  'filledOn' | 'liters' | 'vehicleName'
> & {
  filledOn: Date;
  liters: DecimalLike;
  vehicle: {
    id: string;
    name: string;
  };
};

type VehicleRecord = Omit<VehicleItem, 'estimatedFuelEfficiencyKmPerLiter'> & {
  estimatedFuelEfficiencyKmPerLiter: DecimalLike | null;
};

type VehicleMaintenanceLogRecord = Omit<
  VehicleMaintenanceLogItem,
  'performedOn' | 'vehicleName'
> & {
  performedOn: Date;
  vehicle: {
    id: string;
    name: string;
  };
};

function toNumber(value: DecimalLike): number {
  return typeof value === 'number' ? value : Number(value.toString());
}

export function mapVehicleFuelLogToItem(
  log: VehicleFuelLogRecord
): VehicleFuelLogItem {
  return {
    id: log.id,
    vehicleId: log.vehicleId,
    vehicleName: log.vehicle.name,
    filledOn: log.filledOn.toISOString().slice(0, 10),
    odometerKm: log.odometerKm,
    liters: toNumber(log.liters),
    amountWon: log.amountWon,
    unitPriceWon: log.unitPriceWon,
    isFullTank: log.isFullTank
  };
}

export function mapVehicleToItem(vehicle: VehicleRecord): VehicleItem {
  return {
    id: vehicle.id,
    name: vehicle.name,
    manufacturer: vehicle.manufacturer,
    fuelType: vehicle.fuelType,
    initialOdometerKm: vehicle.initialOdometerKm,
    monthlyExpenseWon: vehicle.monthlyExpenseWon,
    estimatedFuelEfficiencyKmPerLiter:
      vehicle.estimatedFuelEfficiencyKmPerLiter === null
        ? null
        : toNumber(vehicle.estimatedFuelEfficiencyKmPerLiter)
  };
}

export function mapVehicleMaintenanceLogToItem(
  log: VehicleMaintenanceLogRecord
): VehicleMaintenanceLogItem {
  return {
    id: log.id,
    vehicleId: log.vehicleId,
    vehicleName: log.vehicle.name,
    performedOn: log.performedOn.toISOString().slice(0, 10),
    odometerKm: log.odometerKm,
    category: log.category,
    vendor: log.vendor,
    description: log.description,
    amountWon: log.amountWon,
    memo: log.memo
  };
}
