import type {
  AccountingPeriodItem,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { z } from 'zod';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import { createPositiveMoneyWonTextSchema } from '@/shared/lib/money';

export const openingBalanceLineFormSchema = z.object({
  accountSubjectId: z.string().trim().min(1, '계정과목을 선택해 주세요.'),
  fundingAccountId: z.string(),
  balanceAmount: createPositiveMoneyWonTextSchema(
    '잔액은 1원 이상의 안전한 정수로 입력해 주세요.'
  )
});

export const periodFormSchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, '운영 월은 YYYY-MM 형식이어야 합니다.'),
  initializeOpeningBalance: z.boolean(),
  openingBalanceLines: z.array(openingBalanceLineFormSchema),
  note: z.string().max(300, '메모는 300자 이하여야 합니다.')
});

export type PeriodFormInput = z.infer<typeof periodFormSchema>;

export function createEmptyOpeningBalanceLine(): PeriodFormInput['openingBalanceLines'][number] {
  return {
    accountSubjectId: '',
    fundingAccountId: '',
    balanceAmount: ''
  };
}

export type SubmitFeedback = FeedbackAlertValue;

export type ReopenAccountingPeriodPayload = {
  period: AccountingPeriodItem;
  input: ReopenAccountingPeriodRequest;
};
