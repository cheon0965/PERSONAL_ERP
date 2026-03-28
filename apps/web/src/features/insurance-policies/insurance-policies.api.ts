import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockInsurancePolicies: InsurancePolicyItem[] = [
  {
    id: 'ins-1',
    provider: '삼성화재',
    productName: '자동차 보험',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    renewalDate: '2026-11-01',
    maturityDate: null
  },
  {
    id: 'ins-2',
    provider: '메리츠',
    productName: '치아 보험',
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
