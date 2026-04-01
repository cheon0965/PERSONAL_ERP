import {
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind
} from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createImportsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    findImportBatch,
    projectImportBatch,
    findCollectedTransactionByImportedRowId
  } = context;

  return {
    importBatch: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          rows?: {
            orderBy?: { rowNumber?: 'asc' | 'desc' };
          };
        };
      }) => {
        const items = state.importBatches
          .filter((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesId && matchesTenant && matchesLedger;
          })
          .sort(
            (left, right) =>
              right.uploadedAt.getTime() - left.uploadedAt.getTime()
          );

        const candidate = items[0];
        return candidate ? projectImportBatch(candidate, args.include) : null;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          rows?: {
            orderBy?: { rowNumber?: 'asc' | 'desc' };
          };
        };
        orderBy?: {
          uploadedAt?: 'asc' | 'desc';
        };
      }) => {
        const items = state.importBatches
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesTenant && matchesLedger;
          })
          .sort(
            (left, right) =>
              right.uploadedAt.getTime() - left.uploadedAt.getTime()
          );

        return items.map((candidate) =>
          projectImportBatch(candidate, args.include)
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string | null;
          sourceKind: ImportSourceKind;
          fileName: string;
          fileHash: string;
          rowCount: number;
          parseStatus: ImportBatchParseStatus;
          uploadedByMembershipId: string;
        };
      }) => {
        const created = {
          id: `import-batch-${state.importBatches.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          sourceKind: args.data.sourceKind,
          fileName: args.data.fileName,
          fileHash: args.data.fileHash,
          rowCount: args.data.rowCount,
          parseStatus: args.data.parseStatus,
          uploadedByMembershipId: args.data.uploadedByMembershipId,
          uploadedAt: new Date()
        };

        state.importBatches.push(created);
        return created;
      }
    },
    importedRow: {
      findFirst: async (args: {
        where?: {
          id?: string;
          batchId?: string;
          batch?: {
            tenantId?: string;
            ledgerId?: string;
          };
        };
        select?: {
          id?: boolean;
          parseStatus?: boolean;
          rawPayload?: boolean;
          sourceFingerprint?: boolean;
          createdCollectedTransaction?: {
            select?: {
              id?: boolean;
            };
          };
          batch?: {
            select?: {
              sourceKind?: boolean;
            };
          };
        };
      }) => {
        const candidate = state.importedRows.find((row) => {
          const batch = findImportBatch(row.batchId);
          const matchesId = !args.where?.id || row.id === args.where.id;
          const matchesBatchId =
            !args.where?.batchId || row.batchId === args.where.batchId;
          const matchesTenant =
            !args.where?.batch?.tenantId ||
            batch?.tenantId === args.where.batch.tenantId;
          const matchesLedger =
            !args.where?.batch?.ledgerId ||
            batch?.ledgerId === args.where.batch.ledgerId;

          return matchesId && matchesBatchId && matchesTenant && matchesLedger;
        });

        if (!candidate) {
          return null;
        }

        const batch = findImportBatch(candidate.batchId);
        const createdCollectedTransaction =
          findCollectedTransactionByImportedRowId(candidate.id);

        if (!args.select) {
          return {
            ...candidate,
            createdCollectedTransaction: createdCollectedTransaction
              ? { id: createdCollectedTransaction.id }
              : null,
            batch: batch
              ? {
                  sourceKind: batch.sourceKind
                }
              : null
          };
        }

        return {
          ...(args.select.id ? { id: candidate.id } : {}),
          ...(args.select.parseStatus
            ? { parseStatus: candidate.parseStatus }
            : {}),
          ...(args.select.rawPayload
            ? { rawPayload: candidate.rawPayload }
            : {}),
          ...(args.select.sourceFingerprint
            ? { sourceFingerprint: candidate.sourceFingerprint }
            : {}),
          ...(args.select.createdCollectedTransaction
            ? {
                createdCollectedTransaction: createdCollectedTransaction
                  ? {
                      ...(args.select.createdCollectedTransaction.select?.id
                        ? { id: createdCollectedTransaction.id }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.batch
            ? {
                batch: batch
                  ? {
                      ...(args.select.batch.select?.sourceKind
                        ? { sourceKind: batch.sourceKind }
                        : {})
                    }
                  : null
              }
            : {})
        };
      },
      create: async (args: {
        data: {
          batchId: string;
          rowNumber: number;
          rawPayload: Record<string, unknown>;
          parseStatus: ImportedRowParseStatus;
          parseError: string | null;
          sourceFingerprint: string | null;
        };
      }) => {
        const batch = findImportBatch(args.data.batchId);
        if (!batch) {
          throw new Error('Import batch not found');
        }

        const created = {
          id: `imported-row-${state.importedRows.length + 1}`,
          batchId: args.data.batchId,
          rowNumber: args.data.rowNumber,
          rawPayload: args.data.rawPayload,
          parseStatus: args.data.parseStatus,
          parseError: args.data.parseError,
          sourceFingerprint: args.data.sourceFingerprint
        };

        state.importedRows.push(created);
        return created;
      }
    }
  };
}
