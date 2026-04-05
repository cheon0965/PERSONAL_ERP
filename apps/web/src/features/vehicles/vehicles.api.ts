import type {
  CreateVehicleRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { fetchJson, patchJson, postJson } from '@/shared/api/fetch-json';

export const vehiclesQueryKey = ['vehicles'] as const;
export const vehicleMaintenanceLogsQueryKey = ['vehicle-maintenance-logs'] as const;

export const mockVehicles: VehicleItem[] = [
  {
    id: 'veh-1',
    name: '포터2 배송차량',
    manufacturer: 'Hyundai',
    fuelType: 'DIESEL',
    initialOdometerKm: 128000,
    monthlyExpenseWon: 286000,
    estimatedFuelEfficiencyKmPerLiter: 10.8,
    fuelLogs: [
      {
        id: 'fuel-1',
        filledOn: '2026-03-03',
        odometerKm: 128240,
        liters: 52.3,
        amountWon: 84000,
        unitPriceWon: 1606,
        isFullTank: true
      },
      {
        id: 'fuel-2',
        filledOn: '2026-03-15',
        odometerKm: 128695,
        liters: 49.6,
        amountWon: 80100,
        unitPriceWon: 1615,
        isFullTank: true
      }
    ]
  },
  {
    id: 'veh-2',
    name: '사무용 경차',
    manufacturer: 'Kia',
    fuelType: 'GASOLINE',
    initialOdometerKm: 32400,
    monthlyExpenseWon: 91000,
    estimatedFuelEfficiencyKmPerLiter: 15.4,
    fuelLogs: []
  }
];

export const mockVehicleMaintenanceLogs: VehicleMaintenanceLogItem[] = [
  {
    id: 'maintenance-1',
    vehicleId: 'veh-1',
    vehicleName: '포터2 배송차량',
    performedOn: '2026-03-21',
    odometerKm: 128720,
    category: 'REPAIR',
    vendor: '현대 블루핸즈',
    description: '브레이크 패드 교체',
    amountWon: 185000,
    memo: '전륜 패드 기준'
  },
  {
    id: 'maintenance-2',
    vehicleId: 'veh-2',
    vehicleName: '사무용 경차',
    performedOn: '2026-03-11',
    odometerKm: 32620,
    category: 'INSPECTION',
    vendor: '기아 오토큐',
    description: '엔진오일 점검',
    amountWon: 42000,
    memo: null
  }
];

export function getVehicles() {
  return fetchJson<VehicleItem[]>('/vehicles', mockVehicles);
}

export function getVehicleMaintenanceLogs() {
  return fetchJson<VehicleMaintenanceLogItem[]>(
    '/vehicles/maintenance-logs',
    mockVehicleMaintenanceLogs
  );
}

export function createVehicle(
  input: CreateVehicleRequest,
  fallback: VehicleItem
) {
  return postJson<VehicleItem, CreateVehicleRequest>('/vehicles', input, fallback);
}

export function updateVehicle(
  vehicleId: string,
  input: UpdateVehicleRequest,
  fallback: VehicleItem
) {
  return patchJson<VehicleItem, UpdateVehicleRequest>(
    `/vehicles/${vehicleId}`,
    input,
    fallback
  );
}

export function createVehicleMaintenanceLog(
  vehicleId: string,
  input: CreateVehicleMaintenanceLogRequest,
  fallback: VehicleMaintenanceLogItem
) {
  return postJson<VehicleMaintenanceLogItem, CreateVehicleMaintenanceLogRequest>(
    `/vehicles/${vehicleId}/maintenance-logs`,
    input,
    fallback
  );
}

export function updateVehicleMaintenanceLog(
  vehicleId: string,
  maintenanceLogId: string,
  input: UpdateVehicleMaintenanceLogRequest,
  fallback: VehicleMaintenanceLogItem
) {
  return patchJson<
    VehicleMaintenanceLogItem,
    UpdateVehicleMaintenanceLogRequest
  >(
    `/vehicles/${vehicleId}/maintenance-logs/${maintenanceLogId}`,
    input,
    fallback
  );
}

export function buildVehicleFallbackItem(
  input: CreateVehicleRequest | UpdateVehicleRequest,
  context?: {
    id?: string;
    fuelLogs?: VehicleItem['fuelLogs'];
  }
): VehicleItem {
  return {
    id: context?.id ?? `vehicle-demo-${Date.now()}`,
    name: input.name,
    manufacturer: input.manufacturer ?? null,
    fuelType: input.fuelType,
    initialOdometerKm: input.initialOdometerKm,
    monthlyExpenseWon: input.monthlyExpenseWon,
    estimatedFuelEfficiencyKmPerLiter:
      input.estimatedFuelEfficiencyKmPerLiter ?? null,
    fuelLogs: context?.fuelLogs ?? []
  };
}

export function buildVehicleMaintenanceLogFallbackItem(
  input:
    | CreateVehicleMaintenanceLogRequest
    | UpdateVehicleMaintenanceLogRequest,
  context: {
    id?: string;
    vehicleId: string;
    vehicleName: string;
  }
): VehicleMaintenanceLogItem {
  return {
    id: context.id ?? `maintenance-demo-${Date.now()}`,
    vehicleId: context.vehicleId,
    vehicleName: context.vehicleName,
    performedOn: input.performedOn,
    odometerKm: input.odometerKm,
    category: input.category,
    vendor: input.vendor ?? null,
    description: input.description,
    amountWon: input.amountWon,
    memo: input.memo ?? null
  };
}

export function mergeVehicleItem(
  current: VehicleItem[] | undefined,
  saved: VehicleItem
) {
  return [saved, ...(current ?? []).filter((item) => item.id !== saved.id)].sort(
    (left, right) => {
      const nameDiff = left.name.localeCompare(right.name);
      if (nameDiff !== 0) {
        return nameDiff;
      }

      const manufacturerDiff = (left.manufacturer ?? '').localeCompare(
        right.manufacturer ?? ''
      );
      if (manufacturerDiff !== 0) {
        return manufacturerDiff;
      }

      return left.initialOdometerKm - right.initialOdometerKm;
    }
  );
}

export function mergeVehicleMaintenanceLogItem(
  current: VehicleMaintenanceLogItem[] | undefined,
  saved: VehicleMaintenanceLogItem
) {
  return [saved, ...(current ?? []).filter((item) => item.id !== saved.id)].sort(
    (left, right) => {
      const performedOnDiff = right.performedOn.localeCompare(left.performedOn);
      if (performedOnDiff !== 0) {
        return performedOnDiff;
      }

      const odometerDiff = right.odometerKm - left.odometerKm;
      if (odometerDiff !== 0) {
        return odometerDiff;
      }

      return left.vehicleName.localeCompare(right.vehicleName);
    }
  );
}
