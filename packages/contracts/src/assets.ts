export type InsuranceCycle = 'MONTHLY' | 'YEARLY';

export type FuelType = 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export type InsurancePolicyItem = {
  id: string;
  provider: string;
  productName: string;
  monthlyPremiumWon: number;
  paymentDay: number;
  cycle: InsuranceCycle;
  renewalDate: string | null;
  maturityDate: string | null;
};

export type FuelLogItem = {
  id: string;
  filledOn: string;
  odometerKm: number;
  liters: number;
  amountWon: number;
  unitPriceWon: number;
  isFullTank: boolean;
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
