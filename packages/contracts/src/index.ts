export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

export type AccountType = 'BANK' | 'CASH' | 'CARD';
export type CategoryKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type TransactionOrigin = 'MANUAL' | 'RECURRING' | 'IMPORT';
export type TransactionStatus = 'POSTED' | 'PENDING' | 'CANCELLED';
export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type InsuranceCycle = 'MONTHLY' | 'YEARLY';
export type FuelType = 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};

export type AccountItem = {
  id: string;
  name: string;
  type: AccountType;
  balanceWon: number;
};

export type CategoryItem = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type TransactionItem = {
  id: string;
  businessDate: string;
  title: string;
  type: TransactionType;
  amountWon: number;
  accountName: string;
  categoryName: string;
  origin: TransactionOrigin;
  status: TransactionStatus;
};

export type CreateTransactionRequest = {
  title: string;
  type: TransactionType;
  amountWon: number;
  businessDate: string;
  accountId: string;
  categoryId?: string;
  memo?: string;
};

export type RecurringRuleItem = {
  id: string;
  title: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  nextRunDate: string | null;
  accountName: string;
  categoryName: string;
  isActive: boolean;
};

export type CreateRecurringRuleRequest = {
  title: string;
  accountId: string;
  categoryId?: string;
  amountWon: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
};

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

export type DashboardSummary = {
  month: string;
  actualBalanceWon: number;
  confirmedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingRecurringWon: number;
  insuranceMonthlyWon: number;
  vehicleMonthlyWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
};

export type ForecastResponse = {
  month: string;
  actualBalanceWon: number;
  expectedIncomeWon: number;
  confirmedExpenseWon: number;
  remainingRecurringWon: number;
  sinkingFundWon: number;
  minimumReserveWon: number;
  expectedMonthEndBalanceWon: number;
  safetySurplusWon: number;
  notes: string[];
};
