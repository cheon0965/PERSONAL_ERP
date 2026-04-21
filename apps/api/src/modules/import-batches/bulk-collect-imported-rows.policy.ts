import type {
  BulkCollectImportedRowsRequest,
  CollectImportedRowRequest
} from '@personal-erp/contracts';
import type { Prisma } from '@prisma/client';
import { TransactionType } from '@prisma/client';

export function normalizeBulkCollectRowIds(rowIds?: string[]): string[] | null {
  if (!rowIds) {
    return null;
  }

  const normalized = [
    ...new Set(rowIds.map((rowId) => rowId.trim()).filter(Boolean))
  ];
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalBulkCollectString(
  value?: string
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeBulkCollectRequest(
  input: BulkCollectImportedRowsRequest
): BulkCollectImportedRowsRequest {
  return {
    ...(input.rowIds
      ? { rowIds: normalizeBulkCollectRowIds(input.rowIds) ?? [] }
      : {}),
    ...(input.type ? { type: input.type } : {}),
    fundingAccountId: input.fundingAccountId.trim(),
    ...(normalizeOptionalBulkCollectString(input.categoryId)
      ? { categoryId: normalizeOptionalBulkCollectString(input.categoryId) }
      : {}),
    ...(normalizeOptionalBulkCollectString(input.memo)
      ? { memo: normalizeOptionalBulkCollectString(input.memo) }
      : {})
  };
}

export function buildCollectRequestForBulkRow(input: {
  request: BulkCollectImportedRowsRequest;
  rawPayload: Prisma.JsonValue;
}): CollectImportedRowRequest {
  return {
    type: input.request.type ?? resolveBulkCollectType(input.rawPayload),
    fundingAccountId: input.request.fundingAccountId,
    ...(input.request.categoryId
      ? { categoryId: input.request.categoryId }
      : {}),
    ...(input.request.memo ? { memo: input.request.memo } : {})
  };
}

export function resolveBulkCollectType(
  rawPayload: Prisma.JsonValue
): CollectImportedRowRequest['type'] {
  const parsed =
    rawPayload &&
    typeof rawPayload === 'object' &&
    !Array.isArray(rawPayload) &&
    'parsed' in rawPayload &&
    rawPayload.parsed &&
    typeof rawPayload.parsed === 'object' &&
    !Array.isArray(rawPayload.parsed)
      ? (rawPayload.parsed as Record<string, unknown>)
      : null;

  if (parsed?.collectTypeHint === 'REVERSAL') {
    return 'REVERSAL';
  }

  if (parsed?.direction === 'DEPOSIT') {
    return TransactionType.INCOME;
  }

  if (parsed?.direction === 'WITHDRAWAL') {
    return TransactionType.EXPENSE;
  }

  return TransactionType.EXPENSE;
}
