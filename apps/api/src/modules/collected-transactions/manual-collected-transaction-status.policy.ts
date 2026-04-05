import type { CollectedTransactionType } from '@personal-erp/contracts';
import { CollectedTransactionStatus } from '@prisma/client';

export function resolveManualCollectedTransactionStatus(input: {
  type: CollectedTransactionType;
  categoryId?: string | null;
}): CollectedTransactionStatus {
  if (input.type === 'TRANSFER') {
    return CollectedTransactionStatus.READY_TO_POST;
  }

  return normalizeOptionalValue(input.categoryId)
    ? CollectedTransactionStatus.READY_TO_POST
    : CollectedTransactionStatus.REVIEWED;
}

function normalizeOptionalValue(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
