type ImportBatchParseStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
type ImportedRowParseStatus = 'PENDING' | 'PARSED' | 'FAILED';

export function resolveImportBatchParseStatusFromRows(
  statuses: ImportedRowParseStatus[]
): ImportBatchParseStatus {
  if (statuses.length === 0) {
    return 'PENDING';
  }

  const parsedCount = statuses.filter((status) => status === 'PARSED').length;

  if (parsedCount === statuses.length) {
    return 'COMPLETED';
  }

  if (parsedCount === 0) {
    return statuses.every((status) => status === 'PENDING')
      ? 'PENDING'
      : 'FAILED';
  }

  return 'PARTIAL';
}
