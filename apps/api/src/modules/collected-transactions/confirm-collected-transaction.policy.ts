import {
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import type { PostingPolicyKey } from '@prisma/client';
import { buildJournalEntryEntryNumber } from '../journal-entries/public';

const ASSET_SUBJECT_CODE = '1010';
const LIABILITY_SUBJECT_CODE = '2100';
const INCOME_SUBJECT_CODE = '4100';
const EXPENSE_SUBJECT_CODE = '5100';

export const REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES = [
  ASSET_SUBJECT_CODE,
  LIABILITY_SUBJECT_CODE,
  INCOME_SUBJECT_CODE,
  EXPENSE_SUBJECT_CODE
] as const;

type AccountSubjectRecord = {
  id: string;
  code: string;
};

export type ConfirmJournalAccountSubjectIds = {
  assetSubjectId: string;
  liabilitySubjectId: string;
  incomeSubjectId: string;
  expenseSubjectId: string;
};

export type ConfirmJournalLineDraft = {
  lineNumber: number;
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
};

export type ResolveConfirmJournalLinesResult =
  | {
      kind: 'supported';
      lines: ConfirmJournalLineDraft[];
    }
  | {
      kind: 'requires_counterparty_account';
    }
  | {
      kind: 'unsupported_policy';
    };

export function resolveConfirmJournalAccountSubjectIds(
  subjects: AccountSubjectRecord[]
): ConfirmJournalAccountSubjectIds | null {
  const accountSubjectByCode = new Map(
    subjects.map((subject) => [subject.code, subject.id])
  );

  const assetSubjectId = accountSubjectByCode.get(ASSET_SUBJECT_CODE);
  const liabilitySubjectId = accountSubjectByCode.get(LIABILITY_SUBJECT_CODE);
  const incomeSubjectId = accountSubjectByCode.get(INCOME_SUBJECT_CODE);
  const expenseSubjectId = accountSubjectByCode.get(EXPENSE_SUBJECT_CODE);

  if (
    !assetSubjectId ||
    !liabilitySubjectId ||
    !incomeSubjectId ||
    !expenseSubjectId
  ) {
    return null;
  }

  return {
    assetSubjectId,
    liabilitySubjectId,
    incomeSubjectId,
    expenseSubjectId
  };
}

export function buildConfirmCollectedTransactionEntryNumber(
  year: number,
  month: number,
  sequence: number
): string {
  return buildJournalEntryEntryNumber(year, month, sequence);
}

export function assertConfirmJournalAccountSubjectIdsResolved(
  subjects: ConfirmJournalAccountSubjectIds | null
): ConfirmJournalAccountSubjectIds {
  if (subjects) {
    return subjects;
  }

  throw new InternalServerErrorException(
    'Required account subjects are missing in this ledger.'
  );
}

export function resolveConfirmCollectedTransactionJournalLines(input: {
  postingPolicyKey: PostingPolicyKey;
  amount: number;
  title: string;
  fundingAccountId: string;
  accountSubjectIds: ConfirmJournalAccountSubjectIds;
}): ResolveConfirmJournalLinesResult {
  switch (input.postingPolicyKey) {
    case 'INCOME_BASIC':
      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: input.accountSubjectIds.assetSubjectId,
            fundingAccountId: input.fundingAccountId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: input.accountSubjectIds.incomeSubjectId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    case 'EXPENSE_BASIC':
      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: input.accountSubjectIds.expenseSubjectId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: input.accountSubjectIds.assetSubjectId,
            fundingAccountId: input.fundingAccountId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    case 'CARD_SPEND':
      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: input.accountSubjectIds.expenseSubjectId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: input.accountSubjectIds.liabilitySubjectId,
            fundingAccountId: input.fundingAccountId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    case 'TRANSFER_BASIC':
    case 'CARD_PAYMENT':
      return {
        kind: 'requires_counterparty_account'
      };
    default:
      return {
        kind: 'unsupported_policy'
      };
  }
}

export function assertConfirmJournalLinesSupported(
  result: ResolveConfirmJournalLinesResult
): ConfirmJournalLineDraft[] {
  if (result.kind === 'supported') {
    return result.lines;
  }

  if (result.kind === 'requires_counterparty_account') {
    throw new BadRequestException(
      'This posting policy requires a second account selection.'
    );
  }

  throw new BadRequestException(
    'This posting policy is not supported for collected transaction confirmation.'
  );
}
