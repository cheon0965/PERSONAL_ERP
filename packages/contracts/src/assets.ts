import type { MoneyWon } from './money';
import type { CollectedTransactionPostingStatus } from './transactions';

export type InsuranceCycle = 'MONTHLY' | 'YEARLY';

export type FuelType = 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export const vehicleMaintenanceCategoryValues = [
  'INSPECTION',
  'REPAIR',
  'CONSUMABLE',
  'TIRE',
  'ACCIDENT',
  'OTHER'
] as const;

export type VehicleMaintenanceCategory =
  (typeof vehicleMaintenanceCategoryValues)[number];

export type InsurancePolicyItem = {
  id: string;
  provider: string;
  productName: string;
  monthlyPremiumWon: MoneyWon;
  paymentDay: number;
  cycle: InsuranceCycle;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  recurringStartDate: string | null;
  linkedRecurringRuleId: string | null;
  renewalDate: string | null;
  maturityDate: string | null;
  isActive: boolean;
};

export type CreateInsurancePolicyRequest = {
  provider: string;
  productName: string;
  monthlyPremiumWon: MoneyWon;
  paymentDay: number;
  cycle: InsuranceCycle;
  fundingAccountId: string;
  categoryId: string;
  recurringStartDate: string;
  renewalDate?: string | null;
  maturityDate?: string | null;
  isActive?: boolean;
};

export type UpdateInsurancePolicyRequest = CreateInsurancePolicyRequest;

export type FuelLogItem = {
  id: string;
  filledOn: string;
  odometerKm: number;
  liters: number;
  amountWon: MoneyWon;
  unitPriceWon: MoneyWon;
  isFullTank: boolean;
};

export type VehicleLogCollectedTransactionLink = {
  id: string;
  fundingAccountId: string;
  categoryId: string | null;
  postingStatus: CollectedTransactionPostingStatus;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
};

export type VehicleLogAccountingLinkRequest = {
  fundingAccountId: string;
  categoryId?: string | null;
};

export type VehicleFuelLogItem = FuelLogItem & {
  vehicleId: string;
  vehicleName: string;
  linkedCollectedTransaction: VehicleLogCollectedTransactionLink | null;
};

export type VehicleMaintenanceLogItem = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  performedOn: string;
  odometerKm: number;
  category: VehicleMaintenanceCategory;
  vendor: string | null;
  description: string;
  amountWon: MoneyWon;
  memo: string | null;
  linkedCollectedTransaction: VehicleLogCollectedTransactionLink | null;
};

export type VehicleItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  estimatedFuelEfficiencyKmPerLiter: number | null;
  defaultFundingAccountId: string | null;
  defaultFuelCategoryId: string | null;
  defaultMaintenanceCategoryId: string | null;
  operatingExpensePlanOptIn: boolean;
};

export type VehicleOperatingSummaryItem = {
  vehicleId: string;
  vehicleName: string;
  fuelType: FuelType;
  fuelExpenseWon: MoneyWon;
  maintenanceExpenseWon: MoneyWon;
  recordedOperatingExpenseWon: MoneyWon;
  estimatedFuelEfficiencyKmPerLiter: number | null;
  recordedFuelEfficiencyKmPerLiter: number | null;
  fuelLogCount: number;
  maintenanceLogCount: number;
  lastFueledOn: string | null;
  lastMaintainedOn: string | null;
};

export type VehicleOperatingSummaryTotals = {
  vehicleCount: number;
  fuelExpenseWon: MoneyWon;
  maintenanceExpenseWon: MoneyWon;
  recordedOperatingExpenseWon: MoneyWon;
  averageEstimatedFuelEfficiencyKmPerLiter: number | null;
  averageRecordedFuelEfficiencyKmPerLiter: number | null;
};

export type VehicleOperatingSummaryView = {
  totals: VehicleOperatingSummaryTotals;
  items: VehicleOperatingSummaryItem[];
};

export type CreateVehicleRequest = {
  name: string;
  manufacturer?: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  estimatedFuelEfficiencyKmPerLiter?: number | null;
  defaultFundingAccountId?: string | null;
  defaultFuelCategoryId?: string | null;
  defaultMaintenanceCategoryId?: string | null;
  operatingExpensePlanOptIn?: boolean;
};

export type UpdateVehicleRequest = CreateVehicleRequest;

export type CreateVehicleFuelLogRequest = {
  filledOn: string;
  odometerKm: number;
  liters: number;
  amountWon: MoneyWon;
  unitPriceWon: MoneyWon;
  isFullTank: boolean;
  accountingLink?: VehicleLogAccountingLinkRequest | null;
};

export type UpdateVehicleFuelLogRequest = CreateVehicleFuelLogRequest;

export type CreateVehicleMaintenanceLogRequest = {
  performedOn: string;
  odometerKm: number;
  category: VehicleMaintenanceCategory;
  vendor?: string | null;
  description: string;
  amountWon: MoneyWon;
  memo?: string | null;
  accountingLink?: VehicleLogAccountingLinkRequest | null;
};

export type UpdateVehicleMaintenanceLogRequest =
  CreateVehicleMaintenanceLogRequest;
