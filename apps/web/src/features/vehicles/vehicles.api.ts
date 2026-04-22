import type {
  CreateVehicleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest,
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts';
import {
  deleteJson,
  fetchJson,
  patchJson,
  postJson
} from '@/shared/api/fetch-json';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

export const vehiclesQueryKey = ['vehicles'] as const;
export const vehicleOperatingSummaryQueryKey = [
  'vehicle-operating-summary'
] as const;
export const vehicleFuelLogsQueryKey = ['vehicle-fuel-logs'] as const;
export const vehicleMaintenanceLogsQueryKey = [
  'vehicle-maintenance-logs'
] as const;

export const mockVehicles: VehicleItem[] = [
  {
    id: 'veh-1',
    name: '포터2 배송차량',
    manufacturer: 'Hyundai',
    fuelType: 'DIESEL',
    initialOdometerKm: 128000,
    estimatedFuelEfficiencyKmPerLiter: 10.8,
    defaultFundingAccountId: null,
    defaultFuelCategoryId: null,
    defaultMaintenanceCategoryId: null,
    operatingExpensePlanOptIn: false
  },
  {
    id: 'veh-2',
    name: '사무용 경차',
    manufacturer: 'Kia',
    fuelType: 'GASOLINE',
    initialOdometerKm: 32400,
    estimatedFuelEfficiencyKmPerLiter: 15.4,
    defaultFundingAccountId: null,
    defaultFuelCategoryId: null,
    defaultMaintenanceCategoryId: null,
    operatingExpensePlanOptIn: false
  }
];

export const mockVehicleFuelLogs: VehicleFuelLogItem[] = [
  {
    id: 'fuel-1',
    vehicleId: 'veh-1',
    vehicleName: '포터2 배송차량',
    filledOn: '2026-03-03',
    odometerKm: 128240,
    liters: 52.3,
    amountWon: 84000,
    unitPriceWon: 1606,
    isFullTank: true,
    linkedCollectedTransaction: null
  },
  {
    id: 'fuel-2',
    vehicleId: 'veh-1',
    vehicleName: '포터2 배송차량',
    filledOn: '2026-03-15',
    odometerKm: 128695,
    liters: 49.6,
    amountWon: 80100,
    unitPriceWon: 1615,
    isFullTank: true,
    linkedCollectedTransaction: null
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
    memo: '전륜 패드 기준',
    linkedCollectedTransaction: null
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
    memo: null,
    linkedCollectedTransaction: null
  }
];

export const mockVehicleOperatingSummary: VehicleOperatingSummaryView =
  buildVehicleOperatingSummaryView({
    vehicles: mockVehicles,
    fuelLogs: mockVehicleFuelLogs,
    maintenanceLogs: mockVehicleMaintenanceLogs
  });

export function getVehicles() {
  return fetchJson<VehicleItem[]>('/vehicles', mockVehicles);
}

export function getVehicleOperatingSummary() {
  return fetchJson<VehicleOperatingSummaryView>(
    '/vehicles/operating-summary',
    mockVehicleOperatingSummary
  );
}

export function getVehicleFuelLogs() {
  return fetchJson<VehicleFuelLogItem[]>(
    '/vehicles/fuel-logs',
    mockVehicleFuelLogs
  );
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
  return postJson<VehicleItem, CreateVehicleRequest>(
    '/vehicles',
    input,
    fallback
  );
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

export function createVehicleFuelLog(
  vehicleId: string,
  input: CreateVehicleFuelLogRequest,
  fallback: VehicleFuelLogItem
) {
  return postJson<VehicleFuelLogItem, CreateVehicleFuelLogRequest>(
    `/vehicles/${vehicleId}/fuel-logs`,
    input,
    fallback
  );
}

export function updateVehicleFuelLog(
  vehicleId: string,
  fuelLogId: string,
  input: UpdateVehicleFuelLogRequest,
  fallback: VehicleFuelLogItem
) {
  return patchJson<VehicleFuelLogItem, UpdateVehicleFuelLogRequest>(
    `/vehicles/${vehicleId}/fuel-logs/${fuelLogId}`,
    input,
    fallback
  );
}

export function deleteVehicleFuelLog(vehicleId: string, fuelLogId: string) {
  return deleteJson<null>(
    `/vehicles/${vehicleId}/fuel-logs/${fuelLogId}`,
    null
  );
}

export function createVehicleMaintenanceLog(
  vehicleId: string,
  input: CreateVehicleMaintenanceLogRequest,
  fallback: VehicleMaintenanceLogItem
) {
  return postJson<
    VehicleMaintenanceLogItem,
    CreateVehicleMaintenanceLogRequest
  >(`/vehicles/${vehicleId}/maintenance-logs`, input, fallback);
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

export function deleteVehicleMaintenanceLog(
  vehicleId: string,
  maintenanceLogId: string
) {
  return deleteJson<null>(
    `/vehicles/${vehicleId}/maintenance-logs/${maintenanceLogId}`,
    null
  );
}

export function buildVehicleFallbackItem(
  input: CreateVehicleRequest | UpdateVehicleRequest,
  context?: {
    id?: string;
  }
): VehicleItem {
  return {
    id: context?.id ?? `vehicle-demo-${Date.now()}`,
    name: input.name,
    manufacturer: input.manufacturer ?? null,
    fuelType: input.fuelType,
    initialOdometerKm: input.initialOdometerKm,
    estimatedFuelEfficiencyKmPerLiter:
      input.estimatedFuelEfficiencyKmPerLiter ?? null,
    defaultFundingAccountId: input.defaultFundingAccountId ?? null,
    defaultFuelCategoryId: input.defaultFuelCategoryId ?? null,
    defaultMaintenanceCategoryId: input.defaultMaintenanceCategoryId ?? null,
    operatingExpensePlanOptIn: input.operatingExpensePlanOptIn ?? false
  };
}

export function buildVehicleFuelLogFallbackItem(
  input: CreateVehicleFuelLogRequest | UpdateVehicleFuelLogRequest,
  context: {
    id?: string;
    vehicleId: string;
    vehicleName: string;
  }
): VehicleFuelLogItem {
  return {
    id: context.id ?? `fuel-demo-${Date.now()}`,
    vehicleId: context.vehicleId,
    vehicleName: context.vehicleName,
    filledOn: input.filledOn,
    odometerKm: input.odometerKm,
    liters: input.liters,
    amountWon: input.amountWon,
    unitPriceWon: input.unitPriceWon,
    isFullTank: input.isFullTank,
    linkedCollectedTransaction: buildLinkedCollectedTransactionFallback(
      input.accountingLink
    )
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
    memo: input.memo ?? null,
    linkedCollectedTransaction: buildLinkedCollectedTransactionFallback(
      input.accountingLink
    )
  };
}

export function mergeVehicleItem(
  current: VehicleItem[] | undefined,
  saved: VehicleItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => {
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
  });
}

export function mergeVehicleFuelLogItem(
  current: VehicleFuelLogItem[] | undefined,
  saved: VehicleFuelLogItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => {
    const filledOnDiff = right.filledOn.localeCompare(left.filledOn);
    if (filledOnDiff !== 0) {
      return filledOnDiff;
    }

    const odometerDiff = right.odometerKm - left.odometerKm;
    if (odometerDiff !== 0) {
      return odometerDiff;
    }

    return left.vehicleName.localeCompare(right.vehicleName);
  });
}

export function removeVehicleFuelLogItem(
  current: VehicleFuelLogItem[] | undefined,
  fuelLogId: string
) {
  return (current ?? []).filter((item) => item.id !== fuelLogId);
}

export function mergeVehicleMaintenanceLogItem(
  current: VehicleMaintenanceLogItem[] | undefined,
  saved: VehicleMaintenanceLogItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => {
    const performedOnDiff = right.performedOn.localeCompare(left.performedOn);
    if (performedOnDiff !== 0) {
      return performedOnDiff;
    }

    const odometerDiff = right.odometerKm - left.odometerKm;
    if (odometerDiff !== 0) {
      return odometerDiff;
    }

    return left.vehicleName.localeCompare(right.vehicleName);
  });
}

export function removeVehicleMaintenanceLogItem(
  current: VehicleMaintenanceLogItem[] | undefined,
  maintenanceLogId: string
) {
  return (current ?? []).filter((item) => item.id !== maintenanceLogId);
}

function buildLinkedCollectedTransactionFallback(
  accountingLink:
    | CreateVehicleFuelLogRequest['accountingLink']
    | CreateVehicleMaintenanceLogRequest['accountingLink']
) {
  if (!accountingLink) {
    return null;
  }

  return {
    id: `ctx-vehicle-demo-${Date.now()}`,
    fundingAccountId: accountingLink.fundingAccountId,
    categoryId: accountingLink.categoryId ?? null,
    postingStatus: accountingLink.categoryId ? 'READY_TO_POST' : 'REVIEWED',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  } as const;
}
