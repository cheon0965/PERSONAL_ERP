import { resolvePlanItemAutoMatch } from './imported-row-plan-item-match.policy';

export type PlanItemCollectionCandidate = {
  id: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date;
  fundingAccountId: string;
  counterpartyFundingAccountId?: string | null;
  fundingAccountDirection?: 'INFLOW' | 'OUTFLOW' | null;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
  existingCollectedTransactionId: string | null;
};

export function resolveMatchedPlanItemCandidate(input: {
  candidates: PlanItemCollectionCandidate[];
  amount: number;
  occurredOn: Date;
  fundingAccountId: string;
  counterpartyFundingAccountId?: string | null;
  fundingAccountDirection?: 'INFLOW' | 'OUTFLOW' | null;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
}): PlanItemCollectionCandidate | null {
  const planItemMatch = resolvePlanItemAutoMatch({
    candidates: input.candidates,
    collected: {
      amount: input.amount,
      occurredOn: input.occurredOn,
      fundingAccountId: input.fundingAccountId,
      counterpartyFundingAccountId: input.counterpartyFundingAccountId,
      fundingAccountDirection: input.fundingAccountDirection,
      ledgerTransactionTypeId: input.ledgerTransactionTypeId,
      categoryId: input.categoryId
    }
  });

  if (planItemMatch.outcome !== 'matched') {
    return null;
  }

  return (
    input.candidates.find(
      (candidate) => candidate.id === planItemMatch.planItemId
    ) ?? null
  );
}
