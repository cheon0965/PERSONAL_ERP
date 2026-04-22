import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { CollectedTransactionStatus } from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

type DecimalLike = number | string | { toString(): string };

type VehicleFuelLogRecord = Omit<
  VehicleFuelLogItem,
  | 'filledOn'
  | 'liters'
  | 'vehicleName'
  | 'amountWon'
  | 'unitPriceWon'
  | 'linkedCollectedTransaction'
> & {
  filledOn: Date;
  liters: DecimalLike;
  amountWon: PrismaMoneyLike;
  unitPriceWon: PrismaMoneyLike;
  vehicle: {
    id: string;
    name: string;
  };
  linkedCollectedTransaction: LinkedCollectedTransactionRecord | null;
};

type VehicleRecord = Omit<VehicleItem, 'estimatedFuelEfficiencyKmPerLiter'> & {
  estimatedFuelEfficiencyKmPerLiter: DecimalLike | null;
};

type VehicleMaintenanceLogRecord = Omit<
  VehicleMaintenanceLogItem,
  'performedOn' | 'vehicleName' | 'amountWon' | 'linkedCollectedTransaction'
> & {
  performedOn: Date;
  amountWon: PrismaMoneyLike;
  vehicle: {
    id: string;
    name: string;
  };
  linkedCollectedTransaction: LinkedCollectedTransactionRecord | null;
};

type LinkedCollectedTransactionRecord = {
  id: string;
  fundingAccountId: string;
  categoryId: string | null;
  status: CollectedTransactionStatus;
  postedJournalEntry: {
    id: string;
    entryNumber: string;
  } | null;
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
    amountWon: fromPrismaMoneyWon(log.amountWon),
    unitPriceWon: fromPrismaMoneyWon(log.unitPriceWon),
    isFullTank: log.isFullTank,
    linkedCollectedTransaction: mapLinkedCollectedTransaction(
      log.linkedCollectedTransaction
    )
  };
}

export function mapVehicleToItem(vehicle: VehicleRecord): VehicleItem {
  return {
    id: vehicle.id,
    name: vehicle.name,
    manufacturer: vehicle.manufacturer,
    fuelType: vehicle.fuelType,
    initialOdometerKm: vehicle.initialOdometerKm,
    estimatedFuelEfficiencyKmPerLiter:
      vehicle.estimatedFuelEfficiencyKmPerLiter === null
        ? null
        : toNumber(vehicle.estimatedFuelEfficiencyKmPerLiter),
    defaultFundingAccountId: vehicle.defaultFundingAccountId ?? null,
    defaultFuelCategoryId: vehicle.defaultFuelCategoryId ?? null,
    defaultMaintenanceCategoryId: vehicle.defaultMaintenanceCategoryId ?? null,
    operatingExpensePlanOptIn: vehicle.operatingExpensePlanOptIn ?? false
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
    amountWon: fromPrismaMoneyWon(log.amountWon),
    memo: log.memo,
    linkedCollectedTransaction: mapLinkedCollectedTransaction(
      log.linkedCollectedTransaction
    )
  };
}

function mapLinkedCollectedTransaction(
  link: LinkedCollectedTransactionRecord | null
) {
  if (!link) {
    return null;
  }

  return {
    id: link.id,
    fundingAccountId: link.fundingAccountId,
    categoryId: link.categoryId,
    postingStatus: mapCollectedTransactionPostingStatus(link.status),
    postedJournalEntryId: link.postedJournalEntry?.id ?? null,
    postedJournalEntryNumber: link.postedJournalEntry?.entryNumber ?? null
  };
}

function mapCollectedTransactionPostingStatus(
  status: CollectedTransactionStatus
) {
  switch (status) {
    case CollectedTransactionStatus.COLLECTED:
      return 'COLLECTED' as const;
    case CollectedTransactionStatus.READY_TO_POST:
      return 'READY_TO_POST' as const;
    case CollectedTransactionStatus.POSTED:
      return 'POSTED' as const;
    case CollectedTransactionStatus.CORRECTED:
      return 'CORRECTED' as const;
    case CollectedTransactionStatus.LOCKED:
      return 'LOCKED' as const;
    case CollectedTransactionStatus.REVIEWED:
    default:
      return 'REVIEWED' as const;
  }
}
