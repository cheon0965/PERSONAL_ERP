import type {
  LiabilityAgreementItem,
  LiabilityRepaymentScheduleItem
} from '@personal-erp/contracts';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

export type LiabilityAgreementRecord = {
  id: string;
  lenderName: string;
  productName: string;
  loanNumberLast4: string | null;
  principalAmount: PrismaMoneyLike;
  borrowedAt: Date;
  maturityDate: Date | null;
  interestRate: PrismaMoneyLike | number | null;
  interestRateType: LiabilityAgreementItem['interestRateType'];
  repaymentMethod: LiabilityAgreementItem['repaymentMethod'];
  paymentDay: number | null;
  defaultFundingAccountId: string;
  liabilityAccountSubjectId: string | null;
  interestExpenseCategoryId: string | null;
  feeExpenseCategoryId: string | null;
  status: LiabilityAgreementItem['status'];
  memo: string | null;
  defaultFundingAccount: {
    name: string;
  };
  liabilityAccountSubject: {
    name: string;
  } | null;
  interestExpenseCategory: {
    name: string;
  } | null;
  feeExpenseCategory: {
    name: string;
  } | null;
};

export type LiabilityRepaymentScheduleRecord = {
  id: string;
  liabilityAgreementId: string;
  dueDate: Date;
  principalAmount: PrismaMoneyLike;
  interestAmount: PrismaMoneyLike;
  feeAmount: PrismaMoneyLike;
  totalAmount: PrismaMoneyLike;
  status: LiabilityRepaymentScheduleItem['status'];
  linkedPlanItemId: string | null;
  postedJournalEntryId: string | null;
  memo: string | null;
  agreement: {
    lenderName: string;
    productName: string;
  };
  linkedPlanItem?: {
    matchedCollectedTransaction?: {
      id: string;
      title: string;
    } | null;
  } | null;
  postedJournalEntry?: {
    id: string;
    entryNumber: string;
  } | null;
};

export function mapLiabilityAgreementToItem(
  record: LiabilityAgreementRecord
): LiabilityAgreementItem {
  return {
    id: record.id,
    lenderName: record.lenderName,
    productName: record.productName,
    loanNumberLast4: record.loanNumberLast4,
    principalAmount: fromPrismaMoneyWon(record.principalAmount),
    borrowedAt: toDateInput(record.borrowedAt),
    maturityDate: record.maturityDate ? toDateInput(record.maturityDate) : null,
    interestRate:
      record.interestRate == null ? null : Number(record.interestRate),
    interestRateType: record.interestRateType,
    repaymentMethod: record.repaymentMethod,
    paymentDay: record.paymentDay,
    defaultFundingAccountId: record.defaultFundingAccountId,
    defaultFundingAccountName: record.defaultFundingAccount.name,
    liabilityAccountSubjectId: record.liabilityAccountSubjectId,
    liabilityAccountSubjectName: record.liabilityAccountSubject?.name ?? null,
    interestExpenseCategoryId: record.interestExpenseCategoryId,
    interestExpenseCategoryName: record.interestExpenseCategory?.name ?? null,
    feeExpenseCategoryId: record.feeExpenseCategoryId,
    feeExpenseCategoryName: record.feeExpenseCategory?.name ?? null,
    status: record.status,
    memo: record.memo
  };
}

export function mapLiabilityRepaymentScheduleToItem(
  record: LiabilityRepaymentScheduleRecord
): LiabilityRepaymentScheduleItem {
  return {
    id: record.id,
    liabilityAgreementId: record.liabilityAgreementId,
    liabilityAgreementTitle: buildLiabilityAgreementTitle(record.agreement),
    dueDate: toDateInput(record.dueDate),
    principalAmount: fromPrismaMoneyWon(record.principalAmount),
    interestAmount: fromPrismaMoneyWon(record.interestAmount),
    feeAmount: fromPrismaMoneyWon(record.feeAmount),
    totalAmount: fromPrismaMoneyWon(record.totalAmount),
    status: readEffectiveRepaymentStatus(record),
    linkedPlanItemId: record.linkedPlanItemId,
    matchedCollectedTransactionId:
      record.linkedPlanItem?.matchedCollectedTransaction?.id ?? null,
    matchedCollectedTransactionTitle:
      record.linkedPlanItem?.matchedCollectedTransaction?.title ?? null,
    postedJournalEntryId:
      record.postedJournalEntry?.id ?? record.postedJournalEntryId,
    postedJournalEntryNumber: record.postedJournalEntry?.entryNumber ?? null,
    memo: record.memo
  };
}

export function buildLiabilityAgreementTitle(input: {
  lenderName: string;
  productName: string;
}) {
  return [input.lenderName, input.productName].filter(Boolean).join(' ');
}

function readEffectiveRepaymentStatus(
  record: LiabilityRepaymentScheduleRecord
): LiabilityRepaymentScheduleItem['status'] {
  if (record.postedJournalEntryId || record.postedJournalEntry) {
    return 'POSTED';
  }

  if (record.linkedPlanItem?.matchedCollectedTransaction) {
    return 'MATCHED';
  }

  if (record.linkedPlanItemId) {
    return 'PLANNED';
  }

  return record.status;
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}
