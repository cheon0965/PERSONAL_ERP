import type {
  CollectedTransactionItem,
  CollectedTransactionPostingStatus,
  CollectedTransactionType
} from '@personal-erp/contracts';

/**
 * 거래 화면에서 버튼 노출과 다음 상태를 판단하는 순수 워크플로 규칙입니다.
 *
 * 서버도 최종 검증을 하지만, 프론트가 같은 기준으로 "수정/삭제/확정 가능 여부"를 계산해야
 * 사용자가 불가능한 액션을 먼저 누르는 일을 줄일 수 있습니다.
 */
export const editableCollectedTransactionStatuses = [
  'COLLECTED',
  'REVIEWED',
  'READY_TO_POST'
] as const satisfies readonly CollectedTransactionPostingStatus[];

export const collectedTransactionStatusFilterOptions = [
  'COLLECTED',
  'REVIEWED',
  'READY_TO_POST',
  'POSTED',
  'CORRECTED',
  'LOCKED'
] as const satisfies readonly CollectedTransactionPostingStatus[];

export function canEditCollectedTransaction(
  transaction: Pick<
    CollectedTransactionItem,
    'postingStatus' | 'postedJournalEntryId'
  > & {
    sourceKind?: CollectedTransactionItem['sourceKind'];
  }
): boolean {
  // 차량 운행/부채 상환에서 생성된 거래는 원천 화면이 소유하므로 거래 화면에서 직접 수정하지 않습니다.
  return (
    transaction.sourceKind !== 'VEHICLE_LOG' &&
    transaction.sourceKind !== 'LIABILITY_REPAYMENT' &&
    transaction.postedJournalEntryId == null &&
    isEditableCollectedTransactionStatus(transaction.postingStatus)
  );
}

export function canDeleteCollectedTransaction(
  transaction: Pick<
    CollectedTransactionItem,
    'postingStatus' | 'postedJournalEntryId'
  > & {
    sourceKind?: CollectedTransactionItem['sourceKind'];
  }
): boolean {
  // 삭제 가능 조건은 현재 수정 가능 조건과 동일하다.
  // 전표가 생긴 뒤에는 삭제 대신 반전/정정 전표로 이력을 남기는 흐름을 사용한다.
  return canEditCollectedTransaction(transaction);
}

export function canConfirmCollectedTransaction(
  transaction: Pick<
    CollectedTransactionItem,
    'postingStatus' | 'postedJournalEntryId'
  >
): boolean {
  // 전표가 아직 없고 READY_TO_POST까지 보강된 거래만 공식 전표 생성 버튼을 열어줍니다.
  return (
    transaction.postedJournalEntryId == null &&
    transaction.postingStatus === 'READY_TO_POST'
  );
}

export function resolveManualCollectedTransactionPostingStatus(input: {
  type: CollectedTransactionType;
  categoryId?: string | null;
}): CollectedTransactionPostingStatus {
  // 이체와 반전은 손익 카테고리 없이도 전표 라인을 구성할 수 있어 바로 준비 상태로 둡니다.
  if (input.type === 'TRANSFER' || input.type === 'REVERSAL') {
    return 'READY_TO_POST';
  }

  // 수기 손익 거래는 카테고리가 있어야 전표 준비 상태가 되며, 없으면 검토 단계에 머뭅니다.
  return normalizeOptionalValue(input.categoryId)
    ? 'READY_TO_POST'
    : 'REVIEWED';
}

export function resolveImportedCollectedTransactionPostingStatus(input: {
  type: CollectedTransactionType;
  categoryName?: string | null;
}): CollectedTransactionPostingStatus {
  // 업로드 행도 이체/반전은 카테고리 매칭 없이 전표 준비 상태로 취급합니다.
  if (input.type === 'TRANSFER' || input.type === 'REVERSAL') {
    return 'READY_TO_POST';
  }

  // 파서나 자동 매칭이 카테고리명을 찾지 못하면 사용자가 확인할 수 있도록 REVIEWED에 남깁니다.
  return hasAssignedCategoryName(input.categoryName)
    ? 'READY_TO_POST'
    : 'REVIEWED';
}

export function resolveCollectedTransactionActionHint(
  status: CollectedTransactionPostingStatus
): string | null {
  switch (status) {
    case 'COLLECTED':
      return '수집 단계입니다. 검토를 마치면 전표 준비 상태로 올릴 수 있습니다.';
    case 'REVIEWED':
      return '검토 단계입니다. 분류를 보완하면 전표 준비 상태로 확정할 수 있습니다.';
    default:
      return null;
  }
}

function isEditableCollectedTransactionStatus(
  status: CollectedTransactionPostingStatus
): status is (typeof editableCollectedTransactionStatuses)[number] {
  return editableCollectedTransactionStatuses.includes(
    status as (typeof editableCollectedTransactionStatuses)[number]
  );
}

function hasAssignedCategoryName(name: string | null | undefined): boolean {
  const normalized = normalizeOptionalValue(name);
  return normalized != null && normalized !== '-';
}

function normalizeOptionalValue(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
