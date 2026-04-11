import type { MoneyWon } from './money';

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

export type VehicleFuelLogItem = FuelLogItem & {
  vehicleId: string;
  vehicleName: string;
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
};

export type VehicleItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  monthlyExpenseWon: MoneyWon;
  estimatedFuelEfficiencyKmPerLiter: number | null;
};

export type CreateVehicleRequest = {
  name: string;
  manufacturer?: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  monthlyExpenseWon: MoneyWon;
  estimatedFuelEfficiencyKmPerLiter?: number | null;
};

export type UpdateVehicleRequest = CreateVehicleRequest;

export type CreateVehicleFuelLogRequest = {
  filledOn: string;
  odometerKm: number;
  liters: number;
  amountWon: MoneyWon;
  unitPriceWon: MoneyWon;
  isFullTank: boolean;
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
};

export type UpdateVehicleMaintenanceLogRequest =
  CreateVehicleMaintenanceLogRequest;
