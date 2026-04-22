import type {
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsTypeOption,
  CollectImportedRowRequest
} from '@personal-erp/contracts';
import type { Prisma } from '@prisma/client';
import { TransactionType } from '@prisma/client';

const BULK_COLLECT_TRANSACTION_TYPES = new Set<
  CollectImportedRowRequest['type']
>([
  TransactionType.INCOME,
  TransactionType.EXPENSE,
  TransactionType.TRANSFER,
  TransactionType.REVERSAL
]);

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
  const categoryId = normalizeOptionalBulkCollectString(input.categoryId);
  const memo = normalizeOptionalBulkCollectString(input.memo);
  const typeOptions = normalizeBulkCollectTypeOptions(input.typeOptions);

  return {
    ...(input.rowIds
      ? { rowIds: normalizeBulkCollectRowIds(input.rowIds) ?? [] }
      : {}),
    ...(input.type ? { type: input.type } : {}),
    fundingAccountId: input.fundingAccountId.trim(),
    ...(categoryId ? { categoryId } : {}),
    ...(memo ? { memo } : {}),
    ...(typeOptions.length > 0 ? { typeOptions } : {})
  };
}

export function normalizeBulkCollectTypeOptions(
  typeOptions?: BulkCollectImportedRowsTypeOption[]
): BulkCollectImportedRowsTypeOption[] {
  if (!typeOptions) {
    return [];
  }

  const optionByType = new Map<
    CollectImportedRowRequest['type'],
    BulkCollectImportedRowsTypeOption
  >();

  typeOptions.forEach((option) => {
    if (!BULK_COLLECT_TRANSACTION_TYPES.has(option.type)) {
      return;
    }

    const categoryId = normalizeOptionalBulkCollectString(option.categoryId);
    const memo = normalizeOptionalBulkCollectString(option.memo);

    if (!categoryId && !memo) {
      optionByType.delete(option.type);
      return;
    }

    optionByType.set(option.type, {
      type: option.type,
      ...(categoryId ? { categoryId } : {}),
      ...(memo ? { memo } : {})
    });
  });

  return [...optionByType.values()];
}

export function buildCollectRequestForBulkRow(input: {
  request: BulkCollectImportedRowsRequest;
  rawPayload: Prisma.JsonValue;
}): CollectImportedRowRequest {
  const type = input.request.type ?? resolveBulkCollectType(input.rawPayload);
  const typeOption = input.request.typeOptions?.find(
    (candidate) => candidate.type === type
  );
  const categoryId = typeOption?.categoryId ?? input.request.categoryId;
  const memo = typeOption?.memo ?? input.request.memo;

  return {
    type,
    fundingAccountId: input.request.fundingAccountId,
    ...(categoryId ? { categoryId } : {}),
    ...(memo ? { memo } : {})
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
