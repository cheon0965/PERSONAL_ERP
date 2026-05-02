import type {
  CreateLiabilityAgreementRequest,
  CreateLiabilityRepaymentScheduleRequest,
  GenerateLiabilityPlanItemResponse,
  LiabilityAgreementItem,
  LiabilityOverviewResponse,
  LiabilityRepaymentScheduleItem,
  UpdateLiabilityAgreementRequest,
  UpdateLiabilityRepaymentScheduleRequest
} from '@personal-erp/contracts';
import { addMoneyWon } from '@personal-erp/money';
import { fetchJson, patchJson, postJson } from '@/shared/api/fetch-json';

export const liabilitiesQueryKey = ['liabilities'] as const;
export const liabilitiesOverviewQueryKey = ['liabilities', 'overview'] as const;
export const liabilityRepaymentsQueryKey = (
  liabilityAgreementId: string | null
) => ['liabilities', liabilityAgreementId, 'repayments'] as const;

export const mockLiabilityAgreements: LiabilityAgreementItem[] = [
  {
    id: 'liability-demo-1',
    lenderName: '하나은행',
    productName: '운전자금 대출',
    loanNumberLast4: '1207',
    principalAmount: 30_000_000,
    borrowedAt: '2026-01-15',
    maturityDate: '2028-01-15',
    interestRate: 4.2,
    interestRateType: 'FIXED',
    repaymentMethod: 'EQUAL_PAYMENT',
    paymentDay: 25,
    defaultFundingAccountId: 'acc-1',
    defaultFundingAccountName: '사업 운영 통장',
    liabilityAccountSubjectId: null,
    liabilityAccountSubjectName: '차입금',
    interestExpenseCategoryId: 'cat-3',
    interestExpenseCategoryName: '이자비용',
    feeExpenseCategoryId: null,
    feeExpenseCategoryName: null,
    status: 'ACTIVE',
    memo: null
  }
];

export const mockLiabilityRepayments: LiabilityRepaymentScheduleItem[] = [
  {
    id: 'liability-repayment-demo-1',
    liabilityAgreementId: 'liability-demo-1',
    liabilityAgreementTitle: '하나은행 운전자금 대출',
    dueDate: '2026-04-25',
    principalAmount: 1_000_000,
    interestAmount: 105_000,
    feeAmount: 0,
    totalAmount: 1_105_000,
    status: 'SCHEDULED',
    linkedPlanItemId: null,
    matchedCollectedTransactionId: null,
    matchedCollectedTransactionTitle: null,
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    memo: null
  }
];

export function getLiabilities(input?: { includeArchived?: boolean }) {
  const includeArchived = input?.includeArchived ?? false;
  return fetchJson<LiabilityAgreementItem[]>(
    includeArchived ? '/liabilities?includeArchived=true' : '/liabilities',
    includeArchived
      ? mockLiabilityAgreements
      : mockLiabilityAgreements.filter((item) => item.status !== 'ARCHIVED')
  );
}

export function getLiabilityOverview() {
  return fetchJson<LiabilityOverviewResponse>('/liabilities/overview', {
    generatedAt: new Date().toISOString(),
    totalAgreementCount: mockLiabilityAgreements.length,
    activeAgreementCount: mockLiabilityAgreements.filter(
      (item) => item.status === 'ACTIVE'
    ).length,
    remainingPrincipalWon: 30_000_000,
    currentPeriodDueWon: 1_105_000,
    nextDueDate: '2026-04-25',
    items: [
      {
        liabilityAgreementId: 'liability-demo-1',
        lenderName: '하나은행',
        productName: '운전자금 대출',
        status: 'ACTIVE',
        remainingPrincipalWon: 30_000_000,
        nextDueDate: '2026-04-25',
        currentPeriodDueWon: 1_105_000,
        scheduledCount: 1,
        plannedCount: 0,
        matchedCount: 0,
        postedCount: 0
      }
    ]
  });
}

export function createLiabilityAgreement(
  input: CreateLiabilityAgreementRequest,
  fallback: LiabilityAgreementItem
) {
  return postJson<LiabilityAgreementItem, CreateLiabilityAgreementRequest>(
    '/liabilities',
    input,
    fallback
  );
}

export function updateLiabilityAgreement(
  liabilityAgreementId: string,
  input: UpdateLiabilityAgreementRequest,
  fallback: LiabilityAgreementItem
) {
  return patchJson<LiabilityAgreementItem, UpdateLiabilityAgreementRequest>(
    `/liabilities/${liabilityAgreementId}`,
    input,
    fallback
  );
}

export function archiveLiabilityAgreement(
  liabilityAgreementId: string,
  fallback: LiabilityAgreementItem
) {
  return postJson<LiabilityAgreementItem, Record<string, never>>(
    `/liabilities/${liabilityAgreementId}/archive`,
    {},
    fallback
  );
}

export function getLiabilityRepayments(liabilityAgreementId: string | null) {
  if (!liabilityAgreementId) {
    return Promise.resolve([]);
  }

  return fetchJson<LiabilityRepaymentScheduleItem[]>(
    `/liabilities/${liabilityAgreementId}/repayments`,
    mockLiabilityRepayments.filter(
      (item) => item.liabilityAgreementId === liabilityAgreementId
    )
  );
}

export function createLiabilityRepayment(
  liabilityAgreementId: string,
  input: CreateLiabilityRepaymentScheduleRequest,
  fallback: LiabilityRepaymentScheduleItem
) {
  return postJson<
    LiabilityRepaymentScheduleItem,
    CreateLiabilityRepaymentScheduleRequest
  >(`/liabilities/${liabilityAgreementId}/repayments`, input, fallback);
}

export function updateLiabilityRepayment(
  liabilityAgreementId: string,
  repaymentId: string,
  input: UpdateLiabilityRepaymentScheduleRequest,
  fallback: LiabilityRepaymentScheduleItem
) {
  return patchJson<
    LiabilityRepaymentScheduleItem,
    UpdateLiabilityRepaymentScheduleRequest
  >(
    `/liabilities/${liabilityAgreementId}/repayments/${repaymentId}`,
    input,
    fallback
  );
}

export function generateLiabilityRepaymentPlanItem(
  liabilityAgreementId: string,
  repaymentId: string,
  fallback: GenerateLiabilityPlanItemResponse
) {
  return postJson<GenerateLiabilityPlanItemResponse, Record<string, never>>(
    `/liabilities/${liabilityAgreementId}/repayments/${repaymentId}/generate-plan-item`,
    {},
    fallback
  );
}

export function buildLiabilityAgreementFallbackItem(
  input: CreateLiabilityAgreementRequest | UpdateLiabilityAgreementRequest,
  context: {
    id?: string;
    defaultFundingAccountName: string;
    interestExpenseCategoryName?: string | null;
    feeExpenseCategoryName?: string | null;
  }
): LiabilityAgreementItem {
  return {
    id: context.id ?? `liability-demo-${Date.now()}`,
    lenderName: input.lenderName,
    productName: input.productName,
    loanNumberLast4: input.loanNumberLast4 ?? null,
    principalAmount: input.principalAmount,
    borrowedAt: input.borrowedAt,
    maturityDate: input.maturityDate ?? null,
    interestRate: input.interestRate ?? null,
    interestRateType: input.interestRateType,
    repaymentMethod: input.repaymentMethod,
    paymentDay: input.paymentDay ?? null,
    defaultFundingAccountId: input.defaultFundingAccountId,
    defaultFundingAccountName: context.defaultFundingAccountName,
    liabilityAccountSubjectId: input.liabilityAccountSubjectId ?? null,
    liabilityAccountSubjectName: null,
    interestExpenseCategoryId: input.interestExpenseCategoryId ?? null,
    interestExpenseCategoryName: context.interestExpenseCategoryName ?? null,
    feeExpenseCategoryId: input.feeExpenseCategoryId ?? null,
    feeExpenseCategoryName: context.feeExpenseCategoryName ?? null,
    status: input.status ?? 'ACTIVE',
    memo: input.memo ?? null
  };
}

export function buildLiabilityRepaymentFallbackItem(
  agreement: LiabilityAgreementItem,
  input:
    | CreateLiabilityRepaymentScheduleRequest
    | UpdateLiabilityRepaymentScheduleRequest,
  context?: {
    id?: string;
    linkedPlanItemId?: string | null;
    matchedCollectedTransactionId?: string | null;
  }
): LiabilityRepaymentScheduleItem {
  const interestAmount = input.interestAmount ?? 0;
  const feeAmount = input.feeAmount ?? 0;
  const status = 'status' in input ? input.status : undefined;
  return {
    id: context?.id ?? `liability-repayment-demo-${Date.now()}`,
    liabilityAgreementId: agreement.id,
    liabilityAgreementTitle: `${agreement.lenderName} ${agreement.productName}`,
    dueDate: input.dueDate,
    principalAmount: input.principalAmount,
    interestAmount,
    feeAmount,
    totalAmount: addMoneyWon(
      addMoneyWon(input.principalAmount, interestAmount),
      feeAmount
    ),
    status: status ?? 'SCHEDULED',
    linkedPlanItemId: context?.linkedPlanItemId ?? null,
    matchedCollectedTransactionId:
      context?.matchedCollectedTransactionId ?? null,
    matchedCollectedTransactionTitle: null,
    postedJournalEntryId: null,
    postedJournalEntryNumber: null,
    memo: input.memo ?? null
  };
}

export function mergeLiabilityAgreementItem(
  current: LiabilityAgreementItem[] | undefined,
  saved: LiabilityAgreementItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status.localeCompare(right.status);
    }

    const lenderDiff = left.lenderName.localeCompare(right.lenderName);
    if (lenderDiff !== 0) {
      return lenderDiff;
    }

    return left.productName.localeCompare(right.productName);
  });
}

export function mergeLiabilityRepaymentItem(
  current: LiabilityRepaymentScheduleItem[] | undefined,
  saved: LiabilityRepaymentScheduleItem
) {
  return [
    saved,
    ...(current ?? []).filter((item) => item.id !== saved.id)
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}
