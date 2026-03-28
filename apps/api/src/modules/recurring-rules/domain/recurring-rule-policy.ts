type MissingOwnedRecurringRuleReference = 'funding_account' | 'category';

export class MissingOwnedRecurringRuleReferenceError extends Error {
  constructor(readonly reference: MissingOwnedRecurringRuleReference) {
    super(
      reference === 'funding_account'
        ? 'Funding account not found'
        : 'Category not found'
    );
    this.name = 'MissingOwnedRecurringRuleReferenceError';
  }
}

export function resolveMissingOwnedRecurringRuleReference(input: {
  fundingAccountExists: boolean;
  categoryExists: boolean;
}): MissingOwnedRecurringRuleReference | null {
  if (!input.fundingAccountExists) {
    return 'funding_account';
  }

  if (!input.categoryExists) {
    return 'category';
  }

  return null;
}

export function prepareRecurringRuleSchedule(input: {
  startDate: string;
  endDate?: string;
  isActive?: boolean;
}): {
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  nextRunDate: Date;
} {
  const startDate = new Date(input.startDate);

  return {
    startDate,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    isActive: input.isActive ?? true,
    nextRunDate: startDate
  };
}
