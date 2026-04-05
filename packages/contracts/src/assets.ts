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
  monthlyPremiumWon: number;
  paymentDay: number;
  cycle: InsuranceCycle;
  renewalDate: string | null;
  maturityDate: string | null;
  isActive: boolean;
};

export type CreateInsurancePolicyRequest = {
  provider: string;
  productName: string;
  monthlyPremiumWon: number;
  paymentDay: number;
  cycle: InsuranceCycle;
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
  amountWon: number;
  unitPriceWon: number;
  isFullTank: boolean;
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
  amountWon: number;
  memo: string | null;
};

export type VehicleItem = {
  id: string;
  name: string;
  manufacturer: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  monthlyExpenseWon: number;
  estimatedFuelEfficiencyKmPerLiter: number | null;
  fuelLogs?: FuelLogItem[];
};

export type CreateVehicleRequest = {
  name: string;
  manufacturer?: string | null;
  fuelType: FuelType;
  initialOdometerKm: number;
  monthlyExpenseWon: number;
  estimatedFuelEfficiencyKmPerLiter?: number | null;
};

export type UpdateVehicleRequest = CreateVehicleRequest;

export type CreateVehicleMaintenanceLogRequest = {
  performedOn: string;
  odometerKm: number;
  category: VehicleMaintenanceCategory;
  vendor?: string | null;
  description: string;
  amountWon: number;
  memo?: string | null;
};

export type UpdateVehicleMaintenanceLogRequest =
  CreateVehicleMaintenanceLogRequest;
