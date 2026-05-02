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

  // 같은 원본 fingerprint가 이미 있으면 자동 확정과 계획 매칭을 멈춘다.
  // 사용자가 중복 여부를 확인할 수 있도록 가장 보수적인 COLLECTED 상태로 남긴다.
  if (input.hasDuplicateSourceFingerprint) {
    return {
      effectiveCategoryId,
      nextStatus: CollectedTransactionStatus.COLLECTED,
      allowPlanItemMatch: false
    };
  }

  // 이체/취소는 카테고리 없이도 전표화할 수 있고, 수입/지출은 카테고리가 있어야 READY가 된다.
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
