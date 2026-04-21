import type {
  AccountingPeriodItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import { z } from 'zod';
import { sumMoneyWon } from '@personal-erp/money';
import { createNonNegativeMoneyWonSchema } from '@/shared/lib/money';

export type JournalEntryAdjustmentMode = 'reverse' | 'correct';

export type JournalEntryAdjustmentDialogProps = {
  open: boolean;
  mode: JournalEntryAdjustmentMode | null;
  entry: JournalEntryItem | null;
  adjustmentPeriod: AccountingPeriodItem | null;
  journalWritablePeriods: AccountingPeriodItem[];
  onClose: () => void;
  onCompleted: (
    createdEntry: JournalEntryItem,
    mode: JournalEntryAdjustmentMode
  ) => void;
};

export type JournalEntryAdjustmentContentProps = Pick<
  JournalEntryAdjustmentDialogProps,
  'adjustmentPeriod' | 'journalWritablePeriods' | 'onClose' | 'onCompleted'
> & {
  entry: JournalEntryItem;
};

export type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

export const reverseJournalEntrySchema = z.object({
  entryDate: z.string().min(1, '전표 일자를 입력해 주세요.'),
  reason: z.string().max(300, '사유는 300자 이하여야 합니다.').optional()
});

const correctionLineSchema = z
  .object({
    accountSubjectId: z.string().min(1, '계정과목을 선택해 주세요.'),
    fundingAccountId: z.string().optional(),
    debitAmount: createNonNegativeMoneyWonSchema(
      '차변 금액은 0 이상이어야 합니다.'
    ),
    creditAmount: createNonNegativeMoneyWonSchema(
      '대변 금액은 0 이상이어야 합니다.'
    ),
    description: z
      .string()
      .max(300, '라인 설명은 300자 이하여야 합니다.')
      .optional()
  })
  .superRefine((value, context) => {
    const hasDebit = value.debitAmount > 0;
    const hasCredit = value.creditAmount > 0;

    if (hasDebit === hasCredit) {
      context.addIssue({
        code: 'custom',
        path: ['debitAmount'],
        message: '각 라인은 차변 또는 대변 중 한쪽만 입력해 주세요.'
      });
    }
  });

export const correctJournalEntrySchema = z
  .object({
    entryDate: z.string().min(1, '전표 일자를 입력해 주세요.'),
    reason: z
      .string()
      .trim()
      .min(1, '정정 사유를 입력해 주세요.')
      .max(300, '정정 사유는 300자 이하여야 합니다.'),
    lines: z
      .array(correctionLineSchema)
      .min(2, '정정 전표에는 최소 2개 라인이 필요합니다.')
  })
  .superRefine((value, context) => {
    const totalDebit = sumMoneyWon(value.lines.map((line) => line.debitAmount));
    const totalCredit = sumMoneyWon(
      value.lines.map((line) => line.creditAmount)
    );

    if (totalDebit <= 0 || totalCredit <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: '정정 전표 금액은 0보다 커야 합니다.'
      });
    }

    if (totalDebit !== totalCredit) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: '차변 합계와 대변 합계가 일치해야 합니다.'
      });
    }
  });

export type ReverseJournalEntryFormInput = z.infer<
  typeof reverseJournalEntrySchema
>;
export type CorrectJournalEntryFormInput = z.infer<
  typeof correctJournalEntrySchema
>;
export type CorrectionLineInput = CorrectJournalEntryFormInput['lines'][number];
