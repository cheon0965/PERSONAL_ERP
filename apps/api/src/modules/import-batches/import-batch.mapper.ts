import type { ImportBatchItem } from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';

export const importBatchRecordInclude =
  Prisma.validator<Prisma.ImportBatchInclude>()({
    rows: {
      include: {
        createdCollectedTransaction: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        rowNumber: 'asc'
      }
    }
  });

export type ImportBatchRecord = Prisma.ImportBatchGetPayload<{
  include: typeof importBatchRecordInclude;
}>;

export function mapImportBatchRecordToItem(
  record: ImportBatchRecord
): ImportBatchItem {
  const parsedRowCount = record.rows.filter(
    (row) => row.parseStatus === 'PARSED'
  ).length;

  return {
    id: record.id,
    sourceKind: record.sourceKind,
    fileName: record.fileName,
    fileHash: record.fileHash,
    rowCount: record.rowCount,
    parseStatus: record.parseStatus,
    uploadedAt: record.uploadedAt.toISOString(),
    parsedRowCount,
    failedRowCount: record.rows.length - parsedRowCount,
    rows: record.rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      parseStatus: row.parseStatus,
      parseError: row.parseError,
      sourceFingerprint: row.sourceFingerprint,
      createdCollectedTransactionId: row.createdCollectedTransaction?.id ?? null,
      rawPayload: normalizeRawPayload(row.rawPayload)
    }))
  };
}

function normalizeRawPayload(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {
    value
  };
}
