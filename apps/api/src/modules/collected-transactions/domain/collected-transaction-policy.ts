type MissingOwnedCollectedTransactionReference = 'funding_account' | 'category';

export class MissingOwnedCollectedTransactionReferenceError extends Error {
  constructor(readonly reference: MissingOwnedCollectedTransactionReference) {
    super(
      reference === 'funding_account'
        ? 'Funding account not found'
        : 'Category not found'
    );
    this.name = 'MissingOwnedCollectedTransactionReferenceError';
  }
}

export function resolveMissingOwnedCollectedTransactionReference(input: {
  fundingAccountExists: boolean;
  categoryExists: boolean;
}): MissingOwnedCollectedTransactionReference | null {
  if (!input.fundingAccountExists) {
    return 'funding_account';
  }

  if (!input.categoryExists) {
    return 'category';
  }

  return null;
}
