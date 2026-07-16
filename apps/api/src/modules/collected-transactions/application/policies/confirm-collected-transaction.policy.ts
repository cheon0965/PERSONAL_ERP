import {
  internalError,
  validationError
} from '../../../../common/application/errors/app-error';
import { buildJournalEntryEntryNumber } from '../../../journal-entries/public';
import type {
  AccountType,
  FundingAccountDirection
} from '@personal-erp/contracts';

type PostingPolicyKey =
  | 'INCOME_BASIC'
  | 'EXPENSE_BASIC'
  | 'TRANSFER_BASIC'
  | 'CARD_SPEND'
  | 'CARD_PAYMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD'
  | 'MANUAL_ADJUSTMENT';

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

  throw internalError('Required account subjects are missing in this ledger.');
}

export function resolveConfirmCollectedTransactionJournalLines(input: {
  postingPolicyKey: PostingPolicyKey;
  amount: number;
  title: string;
  fundingAccountId: string;
  fundingAccountType?: AccountType;
  fundingAccountSubjectId?: string | null;
  counterpartyFundingAccountId?: string | null;
  counterpartyFundingAccountType?: AccountType | null;
  counterpartyFundingAccountSubjectId?: string | null;
  fundingAccountDirection?: FundingAccountDirection | null;
  categoryAccountSubjectId?: string | null;
  accountSubjectIds: ConfirmJournalAccountSubjectIds;
}): ResolveConfirmJournalLinesResult {
  const primaryAssetSubjectId =
    input.fundingAccountSubjectId ?? input.accountSubjectIds.assetSubjectId;
  const primaryLiabilitySubjectId =
    input.fundingAccountSubjectId ?? input.accountSubjectIds.liabilitySubjectId;
  const incomeSubjectId =
    input.categoryAccountSubjectId ?? input.accountSubjectIds.incomeSubjectId;
  const expenseSubjectId =
    input.categoryAccountSubjectId ?? input.accountSubjectIds.expenseSubjectId;

  switch (input.postingPolicyKey) {
    case 'INCOME_BASIC':
      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: primaryAssetSubjectId,
            fundingAccountId: input.fundingAccountId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: incomeSubjectId,
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
            accountSubjectId: expenseSubjectId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: primaryAssetSubjectId,
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
            accountSubjectId: expenseSubjectId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: primaryLiabilitySubjectId,
            fundingAccountId: input.fundingAccountId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    case 'TRANSFER_BASIC': {
      if (!input.counterpartyFundingAccountId) {
        return { kind: 'requires_counterparty_account' };
      }

      const primaryIsSource = input.fundingAccountDirection === 'OUTFLOW';
      const sourceFundingAccountId = primaryIsSource
        ? input.fundingAccountId
        : input.counterpartyFundingAccountId;
      const destinationFundingAccountId = primaryIsSource
        ? input.counterpartyFundingAccountId
        : input.fundingAccountId;
      const sourceAccountSubjectId = primaryIsSource
        ? primaryAssetSubjectId
        : (input.counterpartyFundingAccountSubjectId ??
          input.accountSubjectIds.assetSubjectId);
      const destinationAccountSubjectId = primaryIsSource
        ? (input.counterpartyFundingAccountSubjectId ??
          input.accountSubjectIds.assetSubjectId)
        : primaryAssetSubjectId;

      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: destinationAccountSubjectId,
            fundingAccountId: destinationFundingAccountId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: sourceAccountSubjectId,
            fundingAccountId: sourceFundingAccountId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    }
    case 'CARD_PAYMENT': {
      if (!input.counterpartyFundingAccountId) {
        return { kind: 'requires_counterparty_account' };
      }

      const primaryIsCard = input.fundingAccountType === 'CARD';
      const cardFundingAccountId = primaryIsCard
        ? input.fundingAccountId
        : input.counterpartyFundingAccountId;
      const assetFundingAccountId = primaryIsCard
        ? input.counterpartyFundingAccountId
        : input.fundingAccountId;
      const cardAccountSubjectId = primaryIsCard
        ? primaryLiabilitySubjectId
        : (input.counterpartyFundingAccountSubjectId ??
          input.accountSubjectIds.liabilitySubjectId);
      const assetAccountSubjectId = primaryIsCard
        ? (input.counterpartyFundingAccountSubjectId ??
          input.accountSubjectIds.assetSubjectId)
        : primaryAssetSubjectId;

      return {
        kind: 'supported',
        lines: [
          {
            lineNumber: 1,
            accountSubjectId: cardAccountSubjectId,
            fundingAccountId: cardFundingAccountId,
            debitAmount: input.amount,
            creditAmount: 0,
            description: input.title
          },
          {
            lineNumber: 2,
            accountSubjectId: assetAccountSubjectId,
            fundingAccountId: assetFundingAccountId,
            debitAmount: 0,
            creditAmount: input.amount,
            description: input.title
          }
        ]
      };
    }
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
    throw validationError(
      'This posting policy requires a second account selection.'
    );
  }

  throw validationError(
    'This posting policy is not supported for collected transaction confirmation.'
  );
}
