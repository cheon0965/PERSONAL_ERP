import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockInsurancePolicies: InsurancePolicyItem[] = [
  {
    id: 'ins-1',
    provider: '삼성화재',
    productName: '업무용 차량 보험',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    renewalDate: '2026-11-01',
    maturityDate: null
  },
  {
    id: 'ins-2',
    provider: 'DB손해보험',
    productName: '영업배상 책임보험',
    monthlyPremiumWon: 43000,
    paymentDay: 25,
    cycle: 'MONTHLY',
    renewalDate: '2026-09-15',
    maturityDate: null
  }
];

export function getInsurancePolicies() {
  return fetchJson<InsurancePolicyItem[]>(
    '/insurance-policies',
    mockInsurancePolicies
  );
}
