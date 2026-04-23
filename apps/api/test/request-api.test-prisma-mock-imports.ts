import {
  ImportBatchCollectionJobRowStatus,
  ImportBatchCollectionJobStatus,
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

  const matchesImportBatchId = (
    candidateId: string,
    whereId?: string | { not?: string }
  ) => {
    if (!whereId) {
      return true;
    }

    if (typeof whereId === 'string') {
      return candidateId === whereId;
    }

    return !whereId.not || candidateId !== whereId.not;
  };
  const sortCollectionJobRows = (
    items: typeof state.importBatchCollectionJobRows
  ) => [...items].sort((left, right) => left.rowNumber - right.rowNumber);
  const projectCollectionJobRow = (
    candidate: (typeof state.importBatchCollectionJobRows)[number],
    select?: Record<string, unknown>
  ) => {
    if (!select) {
      return candidate;
    }

    return {
      ...(select.id ? { id: candidate.id } : {}),
      ...(select.jobId ? { jobId: candidate.jobId } : {}),
      ...(select.importedRowId
        ? { importedRowId: candidate.importedRowId }
        : {}),
      ...(select.rowNumber ? { rowNumber: candidate.rowNumber } : {}),
      ...(select.status ? { status: candidate.status } : {}),
      ...(select.collectedTransactionId
        ? { collectedTransactionId: candidate.collectedTransactionId }
        : {}),
      ...(select.message ? { message: candidate.message } : {}),
      ...(select.startedAt ? { startedAt: candidate.startedAt } : {}),
      ...(select.finishedAt ? { finishedAt: candidate.finishedAt } : {}),
      ...(select.createdAt ? { createdAt: candidate.createdAt } : {}),
      ...(select.updatedAt ? { updatedAt: candidate.updatedAt } : {})
    };
  };
  const projectCollectionJob = (
    candidate: (typeof state.importBatchCollectionJobs)[number],
    args?: {
      select?: Record<string, unknown>;
      include?: {
        rows?: {
          orderBy?: { rowNumber?: 'asc' | 'desc' };
        };
      };
    }
  ) => {
    const rows = sortCollectionJobRows(
      state.importBatchCollectionJobRows.filter(
        (row) => row.jobId === candidate.id
      )
    );

    if (args?.include?.rows) {
      return {
        ...candidate,
        rows
      };
    }

    if (!args?.select) {
      return candidate;
    }

    const rowsSelect = args.select.rows as
      | {
          select?: Record<string, unknown>;
        }
      | undefined;

    return {
      ...(args.select.id ? { id: candidate.id } : {}),
      ...(args.select.importBatchId
        ? { importBatchId: candidate.importBatchId }
        : {}),
      ...(args.select.status ? { status: candidate.status } : {}),
      ...(args.select.requestedRowCount
        ? { requestedRowCount: candidate.requestedRowCount }
        : {}),
      ...(args.select.processedRowCount
        ? { processedRowCount: candidate.processedRowCount }
        : {}),
      ...(args.select.succeededCount
        ? { succeededCount: candidate.succeededCount }
        : {}),
      ...(args.select.failedCount
        ? { failedCount: candidate.failedCount }
        : {}),
      ...(args.select.errorMessage
        ? { errorMessage: candidate.errorMessage }
        : {}),
      ...(args.select.createdAt ? { createdAt: candidate.createdAt } : {}),
      ...(args.select.startedAt ? { startedAt: candidate.startedAt } : {}),
      ...(args.select.finishedAt ? { finishedAt: candidate.finishedAt } : {}),
      ...(args.select.heartbeatAt
        ? { heartbeatAt: candidate.heartbeatAt }
        : {}),
      ...(rowsSelect
        ? {
            rows: rows.map((row) =>
              projectCollectionJobRow(row, rowsSelect.select)
            )
          }
        : {})
    };
  };

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
      count: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string | null;
          fundingAccountId?: string | null;
        };
      }) => {
        return state.importBatches.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            args.where?.periodId === undefined ||
            candidate.periodId === args.where.periodId;
          const matchesFundingAccount =
            args.where?.fundingAccountId === undefined ||
            candidate.fundingAccountId === args.where.fundingAccountId;

          return (
            matchesTenant &&
            matchesLedger &&
            matchesPeriod &&
            matchesFundingAccount
          );
        }).length;
      },
      findFirst: async (args: {
        where?: {
          id?: string | { not?: string };
          tenantId?: string;
          ledgerId?: string;
          periodId?: string | null;
          fundingAccountId?: string | null;
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
            const matchesId =
              !args.where?.id ||
              (typeof args.where.id === 'string'
                ? candidate.id === args.where.id
                : !args.where.id.not || candidate.id !== args.where.id.not);
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              args.where?.periodId === undefined ||
              candidate.periodId === args.where.periodId;
            const matchesFundingAccount =
              args.where?.fundingAccountId === undefined ||
              candidate.fundingAccountId === args.where.fundingAccountId;

            return (
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesPeriod &&
              matchesFundingAccount
            );
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
          id?: string | { not?: string };
          tenantId?: string;
          ledgerId?: string;
          periodId?: string | null;
          fundingAccountId?: string | null;
        };
        select?: {
          id?: boolean;
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
        take?: number;
      }) => {
        let items = state.importBatches
          .filter((candidate) => {
            const matchesId =
              !args.where?.id ||
              (typeof args.where.id === 'string'
                ? candidate.id === args.where.id
                : !args.where.id.not || candidate.id !== args.where.id.not);
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              args.where?.periodId === undefined ||
              candidate.periodId === args.where.periodId;
            const matchesFundingAccount =
              args.where?.fundingAccountId === undefined ||
              candidate.fundingAccountId === args.where.fundingAccountId;

            return (
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesPeriod &&
              matchesFundingAccount
            );
          })
          .sort(
            (left, right) =>
              right.uploadedAt.getTime() - left.uploadedAt.getTime()
          );

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        if (args.select) {
          return items.map((candidate) => ({
            ...(args.select?.id ? { id: candidate.id } : {})
          }));
        }

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
          id?: string | { not?: string };
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
    importBatchCollectionJob: {
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          importBatchId: string;
          requestedByMembershipId: string;
          requestedRowCount: number;
          requestPayload: Record<string, unknown>;
          rows?: {
            create?: Array<{
              importedRowId: string;
              rowNumber: number;
            }>;
          };
        };
        select?: Record<string, unknown>;
      }) => {
        const now = new Date();
        const created = {
          id: `import-batch-collection-job-${state.importBatchCollectionJobs.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          importBatchId: args.data.importBatchId,
          requestedByMembershipId: args.data.requestedByMembershipId,
          status: ImportBatchCollectionJobStatus.PENDING,
          requestedRowCount: args.data.requestedRowCount,
          processedRowCount: 0,
          succeededCount: 0,
          failedCount: 0,
          requestPayload: args.data.requestPayload,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          heartbeatAt: null,
          createdAt: now,
          updatedAt: now
        };
        state.importBatchCollectionJobs.push(created);

        for (const row of args.data.rows?.create ?? []) {
          state.importBatchCollectionJobRows.push({
            id: `import-batch-collection-job-row-${state.importBatchCollectionJobRows.length + 1}`,
            jobId: created.id,
            importedRowId: row.importedRowId,
            rowNumber: row.rowNumber,
            status: ImportBatchCollectionJobRowStatus.PENDING,
            collectedTransactionId: null,
            message: null,
            startedAt: null,
            finishedAt: null,
            createdAt: now,
            updatedAt: now
          });
        }

        return projectCollectionJob(created, { select: args.select });
      },
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          importBatchId?: string;
          status?: {
            in?: ImportBatchCollectionJobStatus[];
          };
        };
        orderBy?: {
          createdAt?: 'asc' | 'desc';
        };
        select?: Record<string, unknown>;
        include?: {
          rows?: {
            orderBy?: { rowNumber?: 'asc' | 'desc' };
          };
        };
      }) => {
        const items = state.importBatchCollectionJobs
          .filter((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesBatch =
              !args.where?.importBatchId ||
              candidate.importBatchId === args.where.importBatchId;
            const matchesStatus =
              !args.where?.status?.in ||
              args.where.status.in.includes(candidate.status);

            return (
              matchesId &&
              matchesTenant &&
              matchesId &&
              matchesLedger &&
              matchesBatch &&
              matchesStatus
            );
          })
          .sort((left, right) => {
            if (args.orderBy?.createdAt === 'asc') {
              return left.createdAt.getTime() - right.createdAt.getTime();
            }

            return right.createdAt.getTime() - left.createdAt.getTime();
          });

        const candidate = items[0];
        return candidate ? projectCollectionJob(candidate, args) : null;
      },
      update: async (args: {
        where: { id: string };
        data: Partial<{
          status: ImportBatchCollectionJobStatus;
          processedRowCount: number;
          succeededCount: number;
          failedCount: number;
          errorMessage: string | null;
          startedAt: Date;
          finishedAt: Date;
          heartbeatAt: Date;
        }>;
      }) => {
        const candidate = state.importBatchCollectionJobs.find(
          (item) => item.id === args.where.id
        );
        if (!candidate) {
          throw new Error('Import batch collection job not found');
        }

        Object.assign(candidate, args.data, { updatedAt: new Date() });
        return candidate;
      },
      updateMany: async (args: {
        where?: {
          id?: string;
          status?: {
            not?: ImportBatchCollectionJobStatus;
          };
        };
        data: Partial<{
          status: ImportBatchCollectionJobStatus;
          processedRowCount: number;
          succeededCount: number;
          failedCount: number;
          errorMessage: string | null;
          startedAt: Date;
          finishedAt: Date;
          heartbeatAt: Date;
        }>;
      }) => {
        let count = 0;
        state.importBatchCollectionJobs.forEach((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesStatus =
            !args.where?.status?.not ||
            candidate.status !== args.where.status.not;

          if (!matchesId || !matchesStatus) {
            return;
          }

          Object.assign(candidate, args.data, { updatedAt: new Date() });
          count += 1;
        });

        return {
          count
        };
      },
      deleteMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          importBatchId?: string;
        };
      }) => {
        const beforeCount = state.importBatchCollectionJobs.length;
        const deletedJobIds = state.importBatchCollectionJobs
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesBatch =
              !args.where?.importBatchId ||
              candidate.importBatchId === args.where.importBatchId;

            return matchesTenant && matchesLedger && matchesBatch;
          })
          .map((candidate) => candidate.id);

        state.importBatchCollectionJobs =
          state.importBatchCollectionJobs.filter(
            (candidate) => !deletedJobIds.includes(candidate.id)
          );
        state.importBatchCollectionJobRows =
          state.importBatchCollectionJobRows.filter(
            (candidate) => !deletedJobIds.includes(candidate.jobId)
          );

        return {
          count: beforeCount - state.importBatchCollectionJobs.length
        };
      }
    },
    importBatchCollectionJobRow: {
      update: async (args: {
        where: { id: string };
        data: Partial<{
          status: ImportBatchCollectionJobRowStatus;
          collectedTransactionId: string | null;
          message: string | null;
          startedAt: Date;
          finishedAt: Date;
        }>;
      }) => {
        const candidate = state.importBatchCollectionJobRows.find(
          (item) => item.id === args.where.id
        );
        if (!candidate) {
          throw new Error('Import batch collection job row not found');
        }

        Object.assign(candidate, args.data, { updatedAt: new Date() });
        return candidate;
      }
    },
    importBatchCollectionLock: {
      findFirst: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          importBatchId?: string;
        };
        select?: {
          jobId?: boolean;
          importBatchId?: boolean;
        };
      }) => {
        const candidate =
          state.importBatchCollectionLocks.find((item) => {
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
            const matchesBatch =
              !args.where?.importBatchId ||
              item.importBatchId === args.where.importBatchId;

            return matchesTenant && matchesLedger && matchesBatch;
          }) ?? null;

        if (!candidate || !args.select) {
          return candidate;
        }

        return {
          ...(args.select.jobId ? { jobId: candidate.jobId } : {}),
          ...(args.select.importBatchId
            ? { importBatchId: candidate.importBatchId }
            : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          importBatchId: string;
          jobId: string;
          lockedByMembershipId: string;
          expiresAt: Date;
        };
      }) => {
        const now = new Date();
        const created = {
          id: `import-batch-collection-lock-${state.importBatchCollectionLocks.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          importBatchId: args.data.importBatchId,
          jobId: args.data.jobId,
          lockedByMembershipId: args.data.lockedByMembershipId,
          expiresAt: args.data.expiresAt,
          createdAt: now,
          updatedAt: now
        };
        state.importBatchCollectionLocks.push(created);
        return created;
      },
      updateMany: async (args: {
        where?: {
          jobId?: string;
        };
        data: {
          expiresAt?: Date;
        };
      }) => {
        let count = 0;
        state.importBatchCollectionLocks.forEach((candidate) => {
          const matchesJob =
            !args.where?.jobId || candidate.jobId === args.where.jobId;
          if (!matchesJob) {
            return;
          }

          if (args.data.expiresAt) {
            candidate.expiresAt = args.data.expiresAt;
          }
          candidate.updatedAt = new Date();
          count += 1;
        });

        return { count };
      },
      deleteMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          importBatchId?: string;
          jobId?: string;
          expiresAt?: {
            lt?: Date;
          };
        };
      }) => {
        const beforeCount = state.importBatchCollectionLocks.length;
        state.importBatchCollectionLocks =
          state.importBatchCollectionLocks.filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesJob =
              !args.where?.jobId || candidate.jobId === args.where.jobId;
            const matchesBatch =
              !args.where?.importBatchId ||
              candidate.importBatchId === args.where.importBatchId;
            const matchesExpires =
              !args.where?.expiresAt?.lt ||
              candidate.expiresAt.getTime() < args.where.expiresAt.lt.getTime();

            return !(
              matchesTenant &&
              matchesLedger &&
              matchesBatch &&
              matchesJob &&
              matchesExpires
            );
          });

        return {
          count: beforeCount - state.importBatchCollectionLocks.length
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
