import type { CategoryItem, FundingAccountItem } from '@personal-erp/contracts';
import { z } from 'zod';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { createPositiveMoneyWonSchema } from '@/shared/lib/money';
import type { ManagedRecurringRuleDetailItem } from './recurring-rules.api';

const optionalDayOfMonthSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce
    .number()
    .int()
    .min(1, '일자는 1 이상이어야 합니다.')
    .max(31, '일자는 31 이하여야 합니다.')
    .optional()
);

export const recurringRuleSchema = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상이어야 합니다.'),
  accountId: z.string().min(1, '자금수단을 선택해 주세요.'),
  categoryId: z.string(),
  amountWon: createPositiveMoneyWonSchema('금액은 0보다 커야 합니다.'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  dayOfMonth: optionalDayOfMonthSchema,
  startDate: z.string().min(1, '시작일을 입력해 주세요.'),
  endDate: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED'])
});

export type RecurringRuleFormInput = z.infer<typeof recurringRuleSchema>;

export function buildDefaultValues(): RecurringRuleFormInput {
  return {
    title: '',
    accountId: '',
    categoryId: '',
    amountWon: 0,
    frequency: 'MONTHLY',
    dayOfMonth: 10,
    startDate: getTodayDateInputValue(),
    endDate: '',
    status: 'ACTIVE'
  };
}

export function mapDetailToFormInput(
  recurringRule: ManagedRecurringRuleDetailItem
): RecurringRuleFormInput {
  return {
    title: recurringRule.title,
    accountId: recurringRule.fundingAccountId,
    categoryId: recurringRule.categoryId ?? '',
    amountWon: recurringRule.amountWon,
    frequency: recurringRule.frequency,
    dayOfMonth: recurringRule.dayOfMonth ?? undefined,
    startDate: recurringRule.startDate,
    endDate: recurringRule.endDate ?? '',
    status: recurringRule.isActive ? 'ACTIVE' : 'PAUSED'
  };
}

export function buildCreateResetValues(
  values: RecurringRuleFormInput
): RecurringRuleFormInput {
  return {
    ...buildDefaultValues(),
    accountId: values.accountId,
    frequency: values.frequency,
    dayOfMonth: values.dayOfMonth,
    status: values.status
  };
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

export function isVisibleFundingAccount(
  fundingAccount: FundingAccountItem,
  selectedFundingAccountId: string
) {
  return (
    fundingAccount.status === 'ACTIVE' ||
    fundingAccount.id === selectedFundingAccountId
  );
}

export function isVisibleCategory(
  category: CategoryItem,
  selectedCategoryId: string
) {
  return category.isActive || category.id === selectedCategoryId;
}
