import type { MoneyWon } from './money';

export type LiabilityAgreementStatus = 'ACTIVE' | 'PAID_OFF' | 'ARCHIVED';

export type LiabilityInterestRateType = 'FIXED' | 'VARIABLE';

export type LiabilityRepaymentMethod =
  | 'EQUAL_PRINCIPAL'
  | 'EQUAL_PAYMENT'
  | 'INTEREST_ONLY'
  | 'BULLET'
  | 'MANUAL';

export type LiabilityRepaymentScheduleStatus =
  | 'SCHEDULED'
  | 'PLANNED'
  | 'MATCHED'
  | 'POSTED'
  | 'SKIPPED'
  | 'CANCELLED';

export type LiabilityAgreementItem = {
  id: string;
  lenderName: string;
  productName: string;
  loanNumberLast4: string | null;
  principalAmount: MoneyWon;
  borrowedAt: string;
  maturityDate: string | null;
  interestRate: number | null;
  interestRateType: LiabilityInterestRateType;
  repaymentMethod: LiabilityRepaymentMethod;
  paymentDay: number | null;
  defaultFundingAccountId: string;
  defaultFundingAccountName: string;
  liabilityAccountSubjectId: string | null;
  liabilityAccountSubjectName: string | null;
  interestExpenseCategoryId: string | null;
  interestExpenseCategoryName: string | null;
  feeExpenseCategoryId: string | null;
  feeExpenseCategoryName: string | null;
  status: LiabilityAgreementStatus;
  memo: string | null;
};

export type CreateLiabilityAgreementRequest = {
  lenderName: string;
  productName: string;
  loanNumberLast4?: string | null;
  principalAmount: MoneyWon;
  borrowedAt: string;
  maturityDate?: string | null;
  interestRate?: number | null;
  interestRateType: LiabilityInterestRateType;
  repaymentMethod: LiabilityRepaymentMethod;
  paymentDay?: number | null;
  defaultFundingAccountId: string;
  liabilityAccountSubjectId?: string | null;
  interestExpenseCategoryId?: string | null;
  feeExpenseCategoryId?: string | null;
  status?: LiabilityAgreementStatus;
  memo?: string | null;
};

export type UpdateLiabilityAgreementRequest = CreateLiabilityAgreementRequest;

export type LiabilityRepaymentScheduleItem = {
  id: string;
  liabilityAgreementId: string;
  liabilityAgreementTitle: string;
  dueDate: string;
  principalAmount: MoneyWon;
  interestAmount: MoneyWon;
  feeAmount: MoneyWon;
  totalAmount: MoneyWon;
  status: LiabilityRepaymentScheduleStatus;
  linkedPlanItemId: string | null;
  matchedCollectedTransactionId: string | null;
  matchedCollectedTransactionTitle: string | null;
  postedJournalEntryId: string | null;
  postedJournalEntryNumber: string | null;
  memo: string | null;
};

export type CreateLiabilityRepaymentScheduleRequest = {
  dueDate: string;
  principalAmount: MoneyWon;
  interestAmount?: MoneyWon;
  feeAmount?: MoneyWon;
  memo?: string | null;
};

export type UpdateLiabilityRepaymentScheduleRequest =
  CreateLiabilityRepaymentScheduleRequest & {
    status?: LiabilityRepaymentScheduleStatus;
  };

export type GenerateLiabilityPlanItemResponse = {
  repayment: LiabilityRepaymentScheduleItem;
  createdPlanItemId: string;
  createdCollectedTransactionId: string;
};

export type LiabilityOverviewItem = {
  liabilityAgreementId: string;
  lenderName: string;
  productName: string;
  status: LiabilityAgreementStatus;
  remainingPrincipalWon: MoneyWon;
  nextDueDate: string | null;
  currentPeriodDueWon: MoneyWon;
  scheduledCount: number;
  plannedCount: number;
  matchedCount: number;
  postedCount: number;
};

export type LiabilityOverviewResponse = {
  generatedAt: string;
  totalAgreementCount: number;
  activeAgreementCount: number;
  remainingPrincipalWon: MoneyWon;
  currentPeriodDueWon: MoneyWon;
  nextDueDate: string | null;
  items: LiabilityOverviewItem[];
};
