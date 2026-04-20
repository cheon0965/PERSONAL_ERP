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

  const matchesImportBatchId = (candidateId: string, whereId?: string) =>
    !whereId || candidateId === whereId;

  const matchesImportedRowId = (
    candidateId: string,
    whereId?: string | { in?: string[] }
  ) => {
    if (!whereId) {
      return true;
    }

    if (typeof whereId === 'string') {
      return candidateId === whereId;
    }

    return !whereId.in || whereId.in.includes(candidateId);
  };

  return {
    importBatch: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
              type?: boolean;
            };
          };
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
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
              type?: boolean;
            };
          };
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
          fundingAccountId: string | null;
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
          fundingAccountId: args.data.fundingAccountId,
          rowCount: args.data.rowCount,
          parseStatus: args.data.parseStatus,
          uploadedByMembershipId: args.data.uploadedByMembershipId,
          uploadedAt: new Date()
        };

        state.importBatches.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          rowCount?: number;
          parseStatus?: ImportBatchParseStatus;
        };
      }) => {
        const candidate = findImportBatch(args.where.id);
        if (!candidate) {
          throw new Error('Import batch not found');
        }

        if (args.data.rowCount !== undefined) {
          candidate.rowCount = args.data.rowCount;
        }

        if (args.data.parseStatus !== undefined) {
          candidate.parseStatus = args.data.parseStatus;
        }

        return candidate;
      },
      deleteMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
      }) => {
        const beforeCount = state.importBatches.length;
        const deletedBatchIds = state.importBatches
          .filter((candidate) => {
            const matchesId = matchesImportBatchId(
              candidate.id,
              args.where?.id
            );
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesId && matchesTenant && matchesLedger;
          })
          .map((candidate) => candidate.id);

        state.importBatches = state.importBatches.filter(
          (candidate) => !deletedBatchIds.includes(candidate.id)
        );
        state.importedRows = state.importedRows.filter(
          (candidate) => !deletedBatchIds.includes(candidate.batchId)
        );

        return {
          count: beforeCount - state.importBatches.length
        };
      }
    },
    importedRow: {
      findFirst: async (args: {
        where?: {
          id?: string;
          batchId?: string;
          rowNumber?: number;
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
              status?: boolean;
              postedJournalEntry?: {
                select?: {
                  id?: boolean;
                  entryNumber?: boolean;
                  status?: boolean;
                  lines?: {
                    select?: {
                      accountSubjectId?: boolean;
                      fundingAccountId?: boolean;
                      debitAmount?: boolean;
                      creditAmount?: boolean;
                      description?: boolean;
                    };
                    orderBy?: {
                      lineNumber?: 'asc' | 'desc';
                    };
                  };
                };
              };
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
          const matchesRowNumber =
            args.where?.rowNumber === undefined ||
            row.rowNumber === args.where.rowNumber;
          const matchesTenant =
            !args.where?.batch?.tenantId ||
            batch?.tenantId === args.where.batch.tenantId;
          const matchesLedger =
            !args.where?.batch?.ledgerId ||
            batch?.ledgerId === args.where.batch.ledgerId;

          return (
            matchesId &&
            matchesBatchId &&
            matchesRowNumber &&
            matchesTenant &&
            matchesLedger
          );
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
                  ? (() => {
                      const createdCollectedTransactionSelect =
                        args.select?.createdCollectedTransaction?.select;
                      const postedJournalEntrySelect =
                        createdCollectedTransactionSelect?.postedJournalEntry
                          ?.select;
                      const postedJournalEntryLineSelect =
                        postedJournalEntrySelect?.lines?.select;

                      return {
                        ...(createdCollectedTransactionSelect?.id
                          ? { id: createdCollectedTransaction.id }
                          : {}),
                        ...(createdCollectedTransactionSelect?.status
                          ? { status: createdCollectedTransaction.status }
                          : {}),
                        ...(postedJournalEntrySelect
                          ? (() => {
                              const postedJournalEntry =
                                state.journalEntries.find(
                                  (item) =>
                                    item.sourceCollectedTransactionId ===
                                    createdCollectedTransaction.id
                                ) ?? null;

                              return {
                                postedJournalEntry: postedJournalEntry
                                  ? {
                                      ...(postedJournalEntrySelect?.id
                                        ? { id: postedJournalEntry.id }
                                        : {}),
                                      ...(postedJournalEntrySelect?.entryNumber
                                        ? {
                                            entryNumber:
                                              postedJournalEntry.entryNumber
                                          }
                                        : {}),
                                      ...(postedJournalEntrySelect?.status
                                        ? { status: postedJournalEntry.status }
                                        : {}),
                                      ...(postedJournalEntrySelect?.lines
                                        ? {
                                            lines: postedJournalEntry.lines.map(
                                              (line) => ({
                                                ...(postedJournalEntryLineSelect?.accountSubjectId
                                                  ? {
                                                      accountSubjectId:
                                                        line.accountSubjectId
                                                    }
                                                  : {}),
                                                ...(postedJournalEntryLineSelect?.fundingAccountId
                                                  ? {
                                                      fundingAccountId:
                                                        line.fundingAccountId
                                                    }
                                                  : {}),
                                                ...(postedJournalEntryLineSelect?.debitAmount
                                                  ? {
                                                      debitAmount:
                                                        line.debitAmount
                                                    }
                                                  : {}),
                                                ...(postedJournalEntryLineSelect?.creditAmount
                                                  ? {
                                                      creditAmount:
                                                        line.creditAmount
                                                    }
                                                  : {}),
                                                ...(postedJournalEntryLineSelect?.description
                                                  ? {
                                                      description:
                                                        line.description
                                                    }
                                                  : {})
                                              })
                                            )
                                          }
                                        : {})
                                    }
                                  : null
                              };
                            })()
                          : {})
                      };
                    })()
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
      findMany: async (args: {
        where?: {
          id?: string | { in?: string[] };
          batchId?: string;
          batch?: {
            tenantId?: string;
            ledgerId?: string;
          };
        };
        select?: {
          id?: boolean;
          rowNumber?: boolean;
          parseStatus?: boolean;
          rawPayload?: boolean;
          parseError?: boolean;
          sourceFingerprint?: boolean;
          createdCollectedTransaction?: {
            select?: {
              id?: boolean;
            };
          };
        };
        orderBy?: {
          rowNumber?: 'asc' | 'desc';
        };
      }) => {
        const items = state.importedRows
          .filter((row) => {
            const batch = findImportBatch(row.batchId);
            const matchesId = matchesImportedRowId(row.id, args.where?.id);
            const matchesBatchId =
              !args.where?.batchId || row.batchId === args.where.batchId;
            const matchesTenant =
              !args.where?.batch?.tenantId ||
              batch?.tenantId === args.where.batch.tenantId;
            const matchesLedger =
              !args.where?.batch?.ledgerId ||
              batch?.ledgerId === args.where.batch.ledgerId;

            return (
              matchesId && matchesBatchId && matchesTenant && matchesLedger
            );
          })
          .sort((left, right) => {
            if (args.orderBy?.rowNumber === 'desc') {
              return right.rowNumber - left.rowNumber;
            }

            return left.rowNumber - right.rowNumber;
          });

        return items.map((candidate) => {
          const createdCollectedTransaction =
            findCollectedTransactionByImportedRowId(candidate.id);

          if (!args.select) {
            return {
              ...candidate,
              createdCollectedTransaction: createdCollectedTransaction
                ? { id: createdCollectedTransaction.id }
                : null
            };
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.rowNumber
              ? { rowNumber: candidate.rowNumber }
              : {}),
            ...(args.select.parseStatus
              ? { parseStatus: candidate.parseStatus }
              : {}),
            ...(args.select.rawPayload
              ? { rawPayload: candidate.rawPayload }
              : {}),
            ...(args.select.parseError
              ? { parseError: candidate.parseError }
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
              : {})
          };
        });
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
      },
      createMany: async (args: {
        data: Array<{
          batchId: string;
          rowNumber: number;
          rawPayload: Record<string, unknown>;
          parseStatus: ImportedRowParseStatus;
          parseError: string | null;
          sourceFingerprint: string | null;
        }>;
      }) => {
        for (const row of args.data) {
          const batch = findImportBatch(row.batchId);
          if (!batch) {
            throw new Error('Import batch not found');
          }

          state.importedRows.push({
            id: `imported-row-${state.importedRows.length + 1}`,
            batchId: row.batchId,
            rowNumber: row.rowNumber,
            rawPayload: row.rawPayload,
            parseStatus: row.parseStatus,
            parseError: row.parseError,
            sourceFingerprint: row.sourceFingerprint
          });
        }

        return { count: args.data.length };
      },
      deleteMany: async (args: {
        where?: {
          id?: string | { in?: string[] };
          batchId?: string;
        };
      }) => {
        const beforeCount = state.importedRows.length;

        state.importedRows = state.importedRows.filter((candidate) => {
          const matchesId = matchesImportedRowId(candidate.id, args.where?.id);
          const matchesBatchId =
            !args.where?.batchId || candidate.batchId === args.where.batchId;

          return !(matchesId && matchesBatchId);
        });

        return {
          count: beforeCount - state.importedRows.length
        };
      }
    }
  };
}
