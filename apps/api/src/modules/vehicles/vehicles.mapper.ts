import type { FuelLogItem, VehicleItem } from '@personal-erp/contracts';

type DecimalLike = number | string | { toString(): string };

type FuelLogRecord = Omit<FuelLogItem, 'filledOn' | 'liters'> & {
  filledOn: Date;
  liters: DecimalLike;
};

type VehicleRecord = Omit<
  VehicleItem,
  'estimatedFuelEfficiencyKmPerLiter' | 'fuelLogs'
> & {
  estimatedFuelEfficiencyKmPerLiter: DecimalLike | null;
  fuelLogs: FuelLogRecord[];
};

function toNumber(value: DecimalLike): number {
  return typeof value === 'number' ? value : Number(value.toString());
}

function mapFuelLogToItem(log: FuelLogRecord): FuelLogItem {
  return {
    id: log.id,
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
        : toNumber(vehicle.estimatedFuelEfficiencyKmPerLiter),
    fuelLogs: vehicle.fuelLogs.map(mapFuelLogToItem)
  };
}
