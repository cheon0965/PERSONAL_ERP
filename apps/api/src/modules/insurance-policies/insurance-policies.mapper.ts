import type { InsurancePolicyItem } from '@personal-erp/contracts';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

export type InsurancePolicyRecord = {
  id: string;
  provider: string;
  productName: string;
  monthlyPremiumWon: PrismaMoneyLike;
  paymentDay: number;
  cycle: InsurancePolicyItem['cycle'];
  accountId: string | null;
  categoryId: string | null;
  recurringStartDate: Date | null;
  linkedRecurringRuleId: string | null;
  renewalDate: Date | null;
  maturityDate: Date | null;
  isActive: boolean;
  account?: {
    id: string;
    name: string;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
};

export function mapInsurancePolicyToItem(
  item: InsurancePolicyRecord
): InsurancePolicyItem {
  return {
    id: item.id,
    provider: item.provider,
    productName: item.productName,
    monthlyPremiumWon: fromPrismaMoneyWon(item.monthlyPremiumWon),
    paymentDay: item.paymentDay,
    cycle: item.cycle,
    fundingAccountId: item.accountId,
    fundingAccountName: item.account?.name ?? null,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    recurringStartDate:
      item.recurringStartDate?.toISOString().slice(0, 10) ?? null,
    linkedRecurringRuleId: item.linkedRecurringRuleId,
    renewalDate: item.renewalDate?.toISOString().slice(0, 10) ?? null,
    maturityDate: item.maturityDate?.toISOString().slice(0, 10) ?? null,
    isActive: item.isActive
  };
}
