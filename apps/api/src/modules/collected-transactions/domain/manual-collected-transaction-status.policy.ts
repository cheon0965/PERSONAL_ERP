type CollectedTransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REVERSAL';
type CollectedTransactionStatus = 'REVIEWED' | 'READY_TO_POST';

export function resolveManualCollectedTransactionStatus(input: {
  type: CollectedTransactionType;
  categoryId?: string | null;
}): CollectedTransactionStatus {
  if (input.type === 'TRANSFER') {
    return 'READY_TO_POST';
  }

  return normalizeOptionalValue(input.categoryId)
    ? 'READY_TO_POST'
    : 'REVIEWED';
}

function normalizeOptionalValue(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
