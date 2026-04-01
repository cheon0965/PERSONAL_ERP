import type { InsurancePolicyItem } from '@personal-erp/contracts';

type InsurancePolicyRecord = Omit<
  InsurancePolicyItem,
  'renewalDate' | 'maturityDate'
> & {
  renewalDate: Date | null;
  maturityDate: Date | null;
};

export function mapInsurancePolicyToItem(
  item: InsurancePolicyRecord
): InsurancePolicyItem {
  return {
    id: item.id,
    provider: item.provider,
    productName: item.productName,
    monthlyPremiumWon: item.monthlyPremiumWon,
    paymentDay: item.paymentDay,
    cycle: item.cycle,
    renewalDate: item.renewalDate?.toISOString().slice(0, 10) ?? null,
    maturityDate: item.maturityDate?.toISOString().slice(0, 10) ?? null
  };
}
