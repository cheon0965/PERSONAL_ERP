import { ImportBatchParseStatus, ImportedRowParseStatus } from '@prisma/client';

export function resolveImportBatchParseStatusFromRows(
  statuses: ImportedRowParseStatus[]
): ImportBatchParseStatus {
  if (statuses.length === 0) {
    return ImportBatchParseStatus.PENDING;
  }

  const parsedCount = statuses.filter(
    (status) => status === ImportedRowParseStatus.PARSED
  ).length;

  if (parsedCount === statuses.length) {
    return ImportBatchParseStatus.COMPLETED;
  }

  if (parsedCount === 0) {
    return statuses.every((status) => status === ImportedRowParseStatus.PENDING)
      ? ImportBatchParseStatus.PENDING
      : ImportBatchParseStatus.FAILED;
  }

  return ImportBatchParseStatus.PARTIAL;
}
