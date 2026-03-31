export const planItemMatchDateToleranceDays = 3;

export type PlanItemMatchCandidate = {
  id: string;
  plannedAmount: number;
  plannedDate: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
};

export type PlanItemMatchInput = {
  amount: number;
  occurredOn: Date;
  fundingAccountId: string;
  ledgerTransactionTypeId: string;
  categoryId: string | null;
};

export type PlanItemMatchResult =
  | {
      outcome: 'matched';
      planItemId: string;
    }
  | {
      outcome: 'ambiguous';
      planItemIds: string[];
    }
  | {
      outcome: 'unmatched';
    };

export function resolvePlanItemAutoMatch(input: {
  candidates: PlanItemMatchCandidate[];
  collected: PlanItemMatchInput;
}): PlanItemMatchResult {
  const amountCandidates = input.candidates.filter(
    (candidate) => candidate.plannedAmount === input.collected.amount
  );
  if (amountCandidates.length === 0) {
    return {
      outcome: 'unmatched'
    };
  }

  const dateCandidates = amountCandidates.filter((candidate) => {
    const diffDays = Math.abs(
      truncateUtcDay(candidate.plannedDate).getTime() -
        truncateUtcDay(input.collected.occurredOn).getTime()
    );

    return (
      diffDays <=
      planItemMatchDateToleranceDays * 24 * 60 * 60 * 1000
    );
  });
  if (dateCandidates.length === 0) {
    return {
      outcome: 'unmatched'
    };
  }

  const fundingAccountCandidates = dateCandidates.filter(
    (candidate) =>
      candidate.fundingAccountId === input.collected.fundingAccountId
  );
  if (fundingAccountCandidates.length === 0) {
    return {
      outcome: 'unmatched'
    };
  }

  const ledgerTypeCandidates = fundingAccountCandidates.filter(
    (candidate) =>
      candidate.ledgerTransactionTypeId ===
      input.collected.ledgerTransactionTypeId
  );
  if (ledgerTypeCandidates.length === 0) {
    return {
      outcome: 'unmatched'
    };
  }

  const categoryCandidates =
    input.collected.categoryId == null
      ? ledgerTypeCandidates
      : ledgerTypeCandidates.filter(
          (candidate) => candidate.categoryId === input.collected.categoryId
        );
  if (categoryCandidates.length === 0) {
    return {
      outcome: 'unmatched'
    };
  }

  if (categoryCandidates.length === 1) {
    return {
      outcome: 'matched',
      planItemId: categoryCandidates[0]!.id
    };
  }

  return {
    outcome: 'ambiguous',
    planItemIds: categoryCandidates.map((candidate) => candidate.id)
  };
}

function truncateUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}
