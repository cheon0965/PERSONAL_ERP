import { CollectedTransactionStatus } from '@prisma/client';

export function resolveImportedRowAutoPreparation(input: {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REVERSAL';
  requestedCategoryId: string | null;
  matchedPlanItemCategoryId: string | null;
  hasDuplicateSourceFingerprint: boolean;
}): {
  effectiveCategoryId: string | null;
  nextStatus: CollectedTransactionStatus;
  allowPlanItemMatch: boolean;
} {
  const effectiveCategoryId =
    input.requestedCategoryId ?? input.matchedPlanItemCategoryId ?? null;

  if (input.hasDuplicateSourceFingerprint) {
    return {
      effectiveCategoryId,
      nextStatus: CollectedTransactionStatus.COLLECTED,
      allowPlanItemMatch: false
    };
  }

  if (
    input.type === 'TRANSFER' ||
    input.type === 'REVERSAL' ||
    effectiveCategoryId
  ) {
    return {
      effectiveCategoryId,
      nextStatus: CollectedTransactionStatus.READY_TO_POST,
      allowPlanItemMatch: true
    };
  }

  return {
    effectiveCategoryId,
    nextStatus: CollectedTransactionStatus.REVIEWED,
    allowPlanItemMatch: true
  };
}
