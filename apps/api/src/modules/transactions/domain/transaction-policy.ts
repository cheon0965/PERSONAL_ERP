type MissingOwnedTransactionReference = 'account' | 'category';

export class MissingOwnedTransactionReferenceError extends Error {
  constructor(readonly reference: MissingOwnedTransactionReference) {
    super(reference === 'account' ? 'Account not found' : 'Category not found');
    this.name = 'MissingOwnedTransactionReferenceError';
  }
}

export function resolveMissingOwnedTransactionReference(input: {
  accountExists: boolean;
  categoryExists: boolean;
}): MissingOwnedTransactionReference | null {
  if (!input.accountExists) {
    return 'account';
  }

  if (!input.categoryExists) {
    return 'category';
  }

  return null;
}
