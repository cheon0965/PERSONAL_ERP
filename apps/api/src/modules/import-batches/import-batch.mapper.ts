import type { ImportBatchItem } from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import {
  buildImportedRowCollectionSummary,
  mapLedgerTransactionFlowKindToCollectedTransactionType
} from './imported-row-auto-preparation-summary';

export const importBatchRecordInclude =
  Prisma.validator<Prisma.ImportBatchInclude>()({
    fundingAccount: {
      select: {
        id: true,
        name: true,
        type: true
      }
    },
    rows: {
      include: {
        createdCollectedTransaction: {
          select: {
            id: true,
            title: true,
            status: true,
            matchedPlanItem: {
              select: {
                id: true,
                title: true
              }
            },
            ledgerTransactionType: {
              select: {
                flowKind: true
              }
            },
            category: {
              select: {
                id: true,
                name: true
              }
            }
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
    fundingAccountId: record.fundingAccountId,
    fundingAccountName: record.fundingAccount?.name ?? null,
    fundingAccountType: record.fundingAccount?.type ?? null,
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
      createdCollectedTransactionId:
        row.createdCollectedTransaction?.id ?? null,
      collectionSummary: row.createdCollectedTransaction
        ? buildImportedRowCollectionSummary({
            createdCollectedTransactionId: row.createdCollectedTransaction.id,
            createdCollectedTransactionTitle:
              row.createdCollectedTransaction.title,
            createdCollectedTransactionStatus:
              row.createdCollectedTransaction.status,
            type: mapLedgerTransactionFlowKindToCollectedTransactionType(
              row.createdCollectedTransaction.ledgerTransactionType.flowKind
            ),
            matchedPlanItemId:
              row.createdCollectedTransaction.matchedPlanItem?.id ?? null,
            matchedPlanItemTitle:
              row.createdCollectedTransaction.matchedPlanItem?.title ?? null,
            effectiveCategoryId:
              row.createdCollectedTransaction.category?.id ?? null,
            effectiveCategoryName:
              row.createdCollectedTransaction.category?.name ?? null
          })
        : null,
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
