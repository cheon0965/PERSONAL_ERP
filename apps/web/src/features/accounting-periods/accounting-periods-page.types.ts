import type {
  AccountingPeriodItem,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { z } from 'zod';

export const periodFormSchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, '운영 월은 YYYY-MM 형식이어야 합니다.'),
  initializeOpeningBalance: z.boolean(),
  note: z.string().max(300, '메모는 300자 이하여야 합니다.')
});

export type PeriodFormInput = z.infer<typeof periodFormSchema>;

export type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

export type ReopenAccountingPeriodPayload = {
  period: AccountingPeriodItem;
  input: ReopenAccountingPeriodRequest;
};
