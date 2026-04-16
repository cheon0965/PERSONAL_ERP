import type {
  FundingAccountItem,
  InsurancePolicyItem
} from '@personal-erp/contracts';
import { z } from 'zod';
import { createPositiveMoneyWonSchema } from '@/shared/lib/money';

export const insurancePolicySchema = z
  .object({
    provider: z.string().trim().min(2, '보험사 이름은 2자 이상이어야 합니다.'),
    productName: z.string().trim().min(2, '상품명은 2자 이상이어야 합니다.'),
    monthlyPremiumWon: createPositiveMoneyWonSchema(
      '월 보험료는 0보다 커야 합니다.'
    ),
    paymentDay: z.coerce
      .number()
      .int()
      .min(1, '납부일은 1 이상이어야 합니다.')
      .max(31, '납부일은 31 이하여야 합니다.'),
    cycle: z.enum(['MONTHLY', 'YEARLY']),
    fundingAccountId: z.string().min(1, '자금수단을 선택해 주세요.'),
    categoryId: z.string().min(1, '카테고리를 선택해 주세요.'),
    recurringStartDate: z.string().min(1, '반복 시작일을 입력해 주세요.'),
    renewalDate: z.string(),
    maturityDate: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE'])
  })
  .superRefine((value, context) => {
    if (
      value.renewalDate &&
      value.maturityDate &&
      value.maturityDate < value.renewalDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maturityDate'],
        message: '만기일은 갱신일보다 빠를 수 없습니다.'
      });
    }

    if (
      value.recurringStartDate &&
      readDateInputDay(value.recurringStartDate) !== value.paymentDay
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurringStartDate'],
        message: '반복 시작일의 날짜는 납부일과 같아야 합니다.'
      });
    }

    if (
      value.recurringStartDate &&
      value.maturityDate &&
      value.maturityDate < value.recurringStartDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maturityDate'],
        message: '만기일은 반복 시작일보다 빠를 수 없습니다.'
      });
    }
  });

export type InsurancePolicyFormInput = z.infer<typeof insurancePolicySchema>;

export function buildDefaultValues(): InsurancePolicyFormInput {
  return {
    provider: '',
    productName: '',
    monthlyPremiumWon: 0,
    paymentDay: 25,
    cycle: 'MONTHLY',
    fundingAccountId: '',
    categoryId: '',
    recurringStartDate: buildSuggestedRecurringStartDate(25),
    renewalDate: '',
    maturityDate: '',
    status: 'ACTIVE'
  };
}

export function mapPolicyToFormInput(
  insurancePolicy: InsurancePolicyItem
): InsurancePolicyFormInput {
  return {
    provider: insurancePolicy.provider,
    productName: insurancePolicy.productName,
    monthlyPremiumWon: insurancePolicy.monthlyPremiumWon,
    paymentDay: insurancePolicy.paymentDay,
    cycle: insurancePolicy.cycle,
    fundingAccountId: insurancePolicy.fundingAccountId ?? '',
    categoryId: insurancePolicy.categoryId ?? '',
    recurringStartDate:
      insurancePolicy.recurringStartDate ??
      buildSuggestedRecurringStartDate(insurancePolicy.paymentDay),
    renewalDate: insurancePolicy.renewalDate ?? '',
    maturityDate: insurancePolicy.maturityDate ?? '',
    status: insurancePolicy.isActive ? 'ACTIVE' : 'INACTIVE'
  };
}

export function buildSuggestedRecurringStartDate(paymentDay: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentMonthCandidate = new Date(year, month, paymentDay);
  const candidate =
    currentMonthCandidate >= stripTime(today)
      ? currentMonthCandidate
      : new Date(year, month + 1, paymentDay);

  return [
    candidate.getFullYear(),
    String(candidate.getMonth() + 1).padStart(2, '0'),
    String(candidate.getDate()).padStart(2, '0')
  ].join('-');
}

export function readDateInputDay(value: string) {
  const day = Number(value.slice(8, 10));

  return Number.isNaN(day) ? null : day;
}

export function readFundingAccountOptionLabel(
  fundingAccount: FundingAccountItem
) {
  switch (fundingAccount.status) {
    case 'INACTIVE':
      return `${fundingAccount.name} (비활성)`;
    case 'CLOSED':
      return `${fundingAccount.name} (종료)`;
    default:
      return fundingAccount.name;
  }
}

function stripTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
