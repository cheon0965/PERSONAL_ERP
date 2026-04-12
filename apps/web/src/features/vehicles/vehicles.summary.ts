'use client';

import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts';
import { sumMoneyWon } from '@personal-erp/money';

function roundEfficiency(value: number): number {
  return Number(value.toFixed(1));
}

function averageEfficiency(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);

  if (present.length === 0) {
    return null;
  }

  return roundEfficiency(
    present.reduce((total, value) => total + value, 0) / present.length
  );
}

function sortFuelLogsAscending(items: VehicleFuelLogItem[]) {
  return [...items].sort((left, right) => {
    const dateDiff = left.filledOn.localeCompare(right.filledOn);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.odometerKm - right.odometerKm;
  });
}

function sortMaintenanceLogsAscending(items: VehicleMaintenanceLogItem[]) {
  return [...items].sort((left, right) => {
    const dateDiff = left.performedOn.localeCompare(right.performedOn);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.odometerKm - right.odometerKm;
  });
}

function calculateRecordedFuelEfficiency(
  fuelLogs: VehicleFuelLogItem[]
): number | null {
  if (fuelLogs.length < 2) {
    return null;
  }

  const orderedFuelLogs = sortFuelLogsAscending(fuelLogs);
  const distanceKm =
    orderedFuelLogs.at(-1)!.odometerKm - orderedFuelLogs[0]!.odometerKm;
  const totalLiters = orderedFuelLogs.reduce(
    (total, fuelLog) => total + fuelLog.liters,
    0
  );

  if (distanceKm <= 0 || totalLiters <= 0) {
    return null;
  }

  return roundEfficiency(distanceKm / totalLiters);
}

function buildVehicleOperatingSummaryItem(input: {
  vehicle: VehicleItem;
  fuelLogs: VehicleFuelLogItem[];
  maintenanceLogs: VehicleMaintenanceLogItem[];
}): VehicleOperatingSummaryItem {
  const orderedFuelLogs = sortFuelLogsAscending(input.fuelLogs);
  const orderedMaintenanceLogs = sortMaintenanceLogsAscending(
    input.maintenanceLogs
  );
  const fuelExpenseWon = sumMoneyWon(
    orderedFuelLogs.map((fuelLog) => fuelLog.amountWon)
  );
  const maintenanceExpenseWon = sumMoneyWon(
    orderedMaintenanceLogs.map((maintenanceLog) => maintenanceLog.amountWon)
  );

  return {
    vehicleId: input.vehicle.id,
    vehicleName: input.vehicle.name,
    fuelType: input.vehicle.fuelType,
    fuelExpenseWon,
    maintenanceExpenseWon,
    recordedOperatingExpenseWon: sumMoneyWon([
      fuelExpenseWon,
      maintenanceExpenseWon
    ]),
    estimatedFuelEfficiencyKmPerLiter:
      input.vehicle.estimatedFuelEfficiencyKmPerLiter,
    recordedFuelEfficiencyKmPerLiter:
      calculateRecordedFuelEfficiency(orderedFuelLogs),
    fuelLogCount: orderedFuelLogs.length,
    maintenanceLogCount: orderedMaintenanceLogs.length,
    lastFueledOn: orderedFuelLogs.at(-1)?.filledOn ?? null,
    lastMaintainedOn: orderedMaintenanceLogs.at(-1)?.performedOn ?? null
  };
}

export function buildVehicleOperatingSummaryView(input: {
  vehicles: VehicleItem[];
  fuelLogs: VehicleFuelLogItem[];
  maintenanceLogs: VehicleMaintenanceLogItem[];
}): VehicleOperatingSummaryView {
  const items = input.vehicles.map((vehicle) =>
    buildVehicleOperatingSummaryItem({
      vehicle,
      fuelLogs: input.fuelLogs.filter(
        (fuelLog) => fuelLog.vehicleId === vehicle.id
      ),
      maintenanceLogs: input.maintenanceLogs.filter(
        (maintenanceLog) => maintenanceLog.vehicleId === vehicle.id
      )
    })
  );

  return {
    totals: {
      vehicleCount: items.length,
      fuelExpenseWon: sumMoneyWon(items.map((item) => item.fuelExpenseWon)),
      maintenanceExpenseWon: sumMoneyWon(
        items.map((item) => item.maintenanceExpenseWon)
      ),
      recordedOperatingExpenseWon: sumMoneyWon(
        items.map((item) => item.recordedOperatingExpenseWon)
      ),
      averageEstimatedFuelEfficiencyKmPerLiter: averageEfficiency(
        items.map((item) => item.estimatedFuelEfficiencyKmPerLiter)
      ),
      averageRecordedFuelEfficiencyKmPerLiter: averageEfficiency(
        items.map((item) => item.recordedFuelEfficiencyKmPerLiter)
      )
    },
    items
  };
}
