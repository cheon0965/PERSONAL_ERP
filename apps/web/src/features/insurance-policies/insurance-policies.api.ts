import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockInsurancePolicies: InsurancePolicyItem[] = [
  {
    id: 'ins-1',
    provider: 'Samsung Fire',
    productName: 'Auto coverage',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    renewalDate: '2026-11-01',
    maturityDate: null
  },
  {
    id: 'ins-2',
    provider: 'Meritz',
    productName: 'Dental plan',
    monthlyPremiumWon: 43000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    renewalDate: '2026-09-15',
    maturityDate: null
  }
];

export function getInsurancePolicies() {
  return fetchJson<InsurancePolicyItem[]>('/insurance-policies', mockInsurancePolicies);
}
