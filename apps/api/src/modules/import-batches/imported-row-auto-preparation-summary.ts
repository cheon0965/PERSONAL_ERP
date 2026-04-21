import type {
  CollectImportedRowPreview,
  CollectedTransactionPostingStatus,
  CollectedTransactionType,
  ImportedRowAutoPreparationSummary,
  ImportedRowCollectionSummary
} from '@personal-erp/contracts';
import { LedgerTransactionFlowKind } from '@prisma/client';

type ImportedRowAutoPreparationSummaryInput = {
  type: CollectedTransactionType;
  requestedCategoryId: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  effectiveCategoryId: string | null;
  effectiveCategoryName: string | null;
  nextWorkflowStatus: CollectedTransactionPostingStatus;
  hasDuplicateSourceFingerprint: boolean;
  allowPlanItemMatch: boolean;
  targetPeriodMonthLabel?: string;
  willCreateTargetPeriod?: boolean;
  potentialDuplicateTransactionCount?: number;
};

export function buildImportedRowAutoPreparationSummary(
  input: ImportedRowAutoPreparationSummaryInput
): ImportedRowAutoPreparationSummary {
  const decisionReasons: string[] = [];

  if (input.willCreateTargetPeriod && input.targetPeriodMonthLabel) {
    decisionReasons.push(
      `${input.targetPeriodMonthLabel} 운영월이 없어 등록 과정에서 자동으로 추가합니다.`
    );
  }

  if (input.hasDuplicateSourceFingerprint) {
    decisionReasons.push(
      '같은 원본 식별값이 이미 있어 중복 후보로 보류합니다.'
    );
  }

  if ((input.potentialDuplicateTransactionCount ?? 0) > 0) {
    decisionReasons.push(
      `같은 거래일·금액·입출금 유형의 기존 거래 ${input.potentialDuplicateTransactionCount}건이 있어 확인 후 등록해야 합니다.`
    );
  }

  if (input.matchedPlanItemTitle) {
    decisionReasons.push(
      input.allowPlanItemMatch
        ? `계획 항목 "${input.matchedPlanItemTitle}"과 연결합니다.`
        : `계획 항목 "${input.matchedPlanItemTitle}" 후보는 있지만 중복 후보라 자동 연결하지 않습니다.`
    );
  } else {
    decisionReasons.push('자동으로 연결할 단일 계획 항목을 찾지 못했습니다.');
  }

  if (input.requestedCategoryId && input.effectiveCategoryName) {
    decisionReasons.push(
      `선택한 카테고리 "${input.effectiveCategoryName}"를 그대로 적용합니다.`
    );
  } else if (input.matchedPlanItemTitle && input.effectiveCategoryName) {
    decisionReasons.push(
      `계획 항목 기준으로 "${input.effectiveCategoryName}" 카테고리를 보완합니다.`
    );
  } else if (input.effectiveCategoryName) {
    decisionReasons.push(
      `카테고리 "${input.effectiveCategoryName}"를 적용합니다.`
    );
  } else {
    decisionReasons.push('카테고리가 비어 있어 추가 검토가 필요합니다.');
  }

  switch (input.nextWorkflowStatus) {
    case 'COLLECTED':
      decisionReasons.push('중복 후보라 수집 단계로 남깁니다.');
      break;
    case 'REVIEWED':
      decisionReasons.push('카테고리 보완 전까지 검토 상태로 저장합니다.');
      break;
    case 'READY_TO_POST':
      decisionReasons.push(
        (input.type === 'TRANSFER' || input.type === 'REVERSAL') &&
          !input.effectiveCategoryName
          ? input.type === 'REVERSAL'
            ? '승인취소 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
            : '이체 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
          : '즉시 전표 준비 상태로 올립니다.'
      );
      break;
    case 'POSTED':
      decisionReasons.push('이미 전표로 확정된 상태입니다.');
      break;
    case 'CORRECTED':
      decisionReasons.push('원거래가 정정 처리된 상태입니다.');
      break;
    case 'LOCKED':
      decisionReasons.push('잠금 기간에 속해 있어 변경이 제한된 상태입니다.');
      break;
    default:
      break;
  }

  return {
    matchedPlanItemId: input.matchedPlanItemId,
    matchedPlanItemTitle: input.matchedPlanItemTitle,
    effectiveCategoryId: input.effectiveCategoryId,
    effectiveCategoryName: input.effectiveCategoryName,
    nextWorkflowStatus: input.nextWorkflowStatus,
    hasDuplicateSourceFingerprint: input.hasDuplicateSourceFingerprint,
    allowPlanItemMatch: input.allowPlanItemMatch,
    ...(input.potentialDuplicateTransactionCount
      ? {
          potentialDuplicateTransactionCount:
            input.potentialDuplicateTransactionCount
        }
      : {}),
    decisionReasons
  };
}

export function buildCollectImportedRowPreview(input: {
  importedRowId: string;
  occurredOn: Date;
  title: string;
  amountWon: number;
  fundingAccountId: string;
  fundingAccountName: string;
  type: CollectedTransactionType;
  requestedCategoryId: string | null;
  requestedCategoryName: string | null;
  autoPreparation: ImportedRowAutoPreparationSummary;
}): CollectImportedRowPreview {
  return {
    importedRowId: input.importedRowId,
    occurredOn: input.occurredOn.toISOString().slice(0, 10),
    title: input.title,
    amountWon: input.amountWon,
    fundingAccountId: input.fundingAccountId,
    fundingAccountName: input.fundingAccountName,
    type: input.type,
    requestedCategoryId: input.requestedCategoryId,
    requestedCategoryName: input.requestedCategoryName,
    autoPreparation: input.autoPreparation
  };
}

export function buildImportedRowCollectionSummary(input: {
  createdCollectedTransactionId: string;
  createdCollectedTransactionTitle: string;
  createdCollectedTransactionStatus: CollectedTransactionPostingStatus;
  type: CollectedTransactionType;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  effectiveCategoryId: string | null;
  effectiveCategoryName: string | null;
}): ImportedRowCollectionSummary {
  const hasDuplicateSourceFingerprint =
    input.createdCollectedTransactionStatus === 'COLLECTED';

  return {
    createdCollectedTransactionId: input.createdCollectedTransactionId,
    createdCollectedTransactionTitle: input.createdCollectedTransactionTitle,
    createdCollectedTransactionStatus: input.createdCollectedTransactionStatus,
    autoPreparation: buildImportedRowAutoPreparationSummary({
      type: input.type,
      requestedCategoryId: null,
      matchedPlanItemId: input.matchedPlanItemId,
      matchedPlanItemTitle: input.matchedPlanItemTitle,
      effectiveCategoryId: input.effectiveCategoryId,
      effectiveCategoryName: input.effectiveCategoryName,
      nextWorkflowStatus: input.createdCollectedTransactionStatus,
      hasDuplicateSourceFingerprint,
      allowPlanItemMatch: !hasDuplicateSourceFingerprint
    })
  };
}

export function mapLedgerTransactionFlowKindToCollectedTransactionType(
  flowKind: LedgerTransactionFlowKind
): CollectedTransactionType {
  switch (flowKind) {
    case LedgerTransactionFlowKind.INCOME:
      return 'INCOME';
    case LedgerTransactionFlowKind.TRANSFER:
    case LedgerTransactionFlowKind.OPENING_BALANCE:
    case LedgerTransactionFlowKind.CARRY_FORWARD:
      return 'TRANSFER';
    case LedgerTransactionFlowKind.ADJUSTMENT:
      return 'REVERSAL';
    case LedgerTransactionFlowKind.EXPENSE:
    default:
      return 'EXPENSE';
  }
}
