import { resolvePlanItemAutoMatch } from './imported-row-plan-item-match.policy';
import type { DraftPlanItemCandidate } from './imported-row-collection.types';

export function resolveMatchedPlanItemCandidate(input: {
  candidates: DraftPlanItemCandidate[];
  amount: number;
  occurredOn: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
}): DraftPlanItemCandidate | null {
  const planItemMatch = resolvePlanItemAutoMatch({
    candidates: input.candidates,
    collected: {
      amount: input.amount,
      occurredOn: input.occurredOn,
      fundingAccountId: input.fundingAccountId,
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
