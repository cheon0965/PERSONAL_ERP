import type {
  CollectedTransactionItem,
  CollectedTransactionPostingStatus,
  CollectedTransactionType
} from '@personal-erp/contracts';

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
  return (
    transaction.sourceKind !== 'VEHICLE_LOG' &&
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
  return canEditCollectedTransaction(transaction);
}

export function canConfirmCollectedTransaction(
  transaction: Pick<
    CollectedTransactionItem,
    'postingStatus' | 'postedJournalEntryId'
  >
): boolean {
  return (
    transaction.postedJournalEntryId == null &&
    transaction.postingStatus === 'READY_TO_POST'
  );
}

export function resolveManualCollectedTransactionPostingStatus(input: {
  type: CollectedTransactionType;
  categoryId?: string | null;
}): CollectedTransactionPostingStatus {
  if (input.type === 'TRANSFER' || input.type === 'REVERSAL') {
    return 'READY_TO_POST';
  }

  return normalizeOptionalValue(input.categoryId)
    ? 'READY_TO_POST'
    : 'REVIEWED';
}

export function resolveImportedCollectedTransactionPostingStatus(input: {
  type: CollectedTransactionType;
  categoryName?: string | null;
}): CollectedTransactionPostingStatus {
  if (input.type === 'TRANSFER' || input.type === 'REVERSAL') {
    return 'READY_TO_POST';
  }

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
