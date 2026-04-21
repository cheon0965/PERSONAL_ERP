import {
  CollectedTransactionStatus,
  LedgerTransactionFlowKind
} from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createCollectedTransactionWriteMethods(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    findPlanItem,
    resolveAccount,
    resolveCategory,
    resolveLedgerTransactionType,
    resolveJournalEntryByCollectedTransaction
  } = context;

  return {
    create: async (args: {
      data: {
        tenantId: string;
        ledgerId: string;
        periodId?: string;
        importBatchId?: string | null;
        importedRowId?: string | null;
        matchedPlanItemId?: string | null;
        ledgerTransactionTypeId: string;
        fundingAccountId: string;
        categoryId?: string;
        title: string;
        occurredOn: Date;
        amount: number;
        status: CollectedTransactionStatus;
        sourceFingerprint?: string | null;
        memo?: string;
      };
      select?: {
        id?: boolean;
        occurredOn?: boolean;
        title?: boolean;
        amount?: boolean;
        status?: boolean;
        importBatchId?: boolean;
        matchedPlanItemId?: boolean;
        matchedPlanItem?: {
          select?: {
            id?: boolean;
            title?: boolean;
          };
        };
        postedJournalEntry?: {
          select?: {
            id?: boolean;
            entryNumber?: boolean;
          };
        };
        fundingAccount?: {
          select?: { name?: boolean };
        };
        category?: {
          select?: { name?: boolean };
        };
        ledgerTransactionType?: {
          select?: { flowKind?: boolean };
        };
      };
    }) => {
      const fundingAccount = resolveAccount(args.data.fundingAccountId);
      const category = args.data.categoryId
        ? resolveCategory(args.data.categoryId)
        : null;
      const ledgerTransactionType = resolveLedgerTransactionType(
        args.data.ledgerTransactionTypeId
      );
      const created = {
        id: `ctx-${state.collectedTransactions.length + 1}`,
        tenantId: args.data.tenantId,
        ledgerId: args.data.ledgerId,
        periodId: args.data.periodId ?? null,
        ledgerTransactionTypeId: args.data.ledgerTransactionTypeId,
        fundingAccountId: args.data.fundingAccountId,
        categoryId: args.data.categoryId ?? null,
        matchedPlanItemId: args.data.matchedPlanItemId ?? null,
        importBatchId: args.data.importBatchId ?? null,
        importedRowId: args.data.importedRowId ?? null,
        sourceFingerprint: args.data.sourceFingerprint ?? null,
        title: args.data.title,
        occurredOn: new Date(String(args.data.occurredOn)),
        amount: Number(args.data.amount),
        status: args.data.status,
        memo: args.data.memo ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      state.collectedTransactions.push(created);

      if (!args.select) {
        return created;
      }

      const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
        created.id
      );
      const matchedPlanItem = created.matchedPlanItemId
        ? findPlanItem(created.matchedPlanItemId)
        : null;

      return {
        ...(args.select.id ? { id: created.id } : {}),
        ...(args.select.occurredOn ? { occurredOn: created.occurredOn } : {}),
        ...(args.select.title ? { title: created.title } : {}),
        ...(args.select.amount ? { amount: created.amount } : {}),
        ...(args.select.status ? { status: created.status } : {}),
        ...(args.select.importBatchId
          ? { importBatchId: created.importBatchId }
          : {}),
        ...(args.select.matchedPlanItemId
          ? { matchedPlanItemId: created.matchedPlanItemId }
          : {}),
        ...(args.select.matchedPlanItem
          ? {
              matchedPlanItem: matchedPlanItem
                ? {
                    ...(args.select.matchedPlanItem.select?.id
                      ? { id: matchedPlanItem.id }
                      : {}),
                    ...(args.select.matchedPlanItem.select?.title
                      ? { title: matchedPlanItem.title }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.postedJournalEntry
          ? {
              postedJournalEntry: postedJournalEntry
                ? {
                    ...(args.select.postedJournalEntry.select?.id
                      ? { id: postedJournalEntry.id }
                      : {}),
                    ...(args.select.postedJournalEntry.select?.entryNumber
                      ? { entryNumber: postedJournalEntry.entryNumber }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.fundingAccount
          ? {
              fundingAccount: {
                ...(args.select.fundingAccount.select?.name
                  ? { name: fundingAccount?.name ?? '' }
                  : {})
              }
            }
          : {}),
        ...(args.select.category
          ? {
              category: category
                ? {
                    ...(args.select.category.select?.name
                      ? { name: category.name }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.ledgerTransactionType
          ? {
              ledgerTransactionType: {
                ...(args.select.ledgerTransactionType.select?.flowKind
                  ? {
                      flowKind:
                        ledgerTransactionType?.flowKind ??
                        LedgerTransactionFlowKind.EXPENSE
                    }
                  : {})
              }
            }
          : {})
      };
    },
    update: async (args: {
      where: { id: string };
      data: {
        periodId?: string | null;
        importBatchId?: string | null;
        importedRowId?: string | null;
        ledgerTransactionTypeId?: string;
        fundingAccountId?: string;
        categoryId?: string | null;
        title?: string;
        occurredOn?: Date;
        amount?: number;
        status?: CollectedTransactionStatus;
        sourceFingerprint?: string | null;
        memo?: string | null;
      };
      select?: {
        id?: boolean;
        occurredOn?: boolean;
        title?: boolean;
        amount?: boolean;
        status?: boolean;
        importBatchId?: boolean;
        matchedPlanItemId?: boolean;
        matchedPlanItem?: {
          select?: {
            id?: boolean;
            title?: boolean;
          };
        };
        postedJournalEntry?: {
          select?: {
            id?: boolean;
            entryNumber?: boolean;
          };
        };
        fundingAccount?: {
          select?: { name?: boolean };
        };
        category?: {
          select?: { name?: boolean };
        };
        ledgerTransactionType?: {
          select?: { flowKind?: boolean };
        };
      };
    }) => {
      const candidate = state.collectedTransactions.find(
        (item) => item.id === args.where.id
      );

      if (!candidate) {
        throw new Error('Collected transaction not found');
      }

      if ('periodId' in args.data) {
        candidate.periodId = args.data.periodId ?? null;
      }
      if ('importBatchId' in args.data) {
        candidate.importBatchId = args.data.importBatchId ?? null;
      }
      if ('importedRowId' in args.data) {
        candidate.importedRowId = args.data.importedRowId ?? null;
      }
      if (args.data.ledgerTransactionTypeId) {
        candidate.ledgerTransactionTypeId = args.data.ledgerTransactionTypeId;
      }
      if (args.data.fundingAccountId) {
        candidate.fundingAccountId = args.data.fundingAccountId;
      }
      if ('categoryId' in args.data) {
        candidate.categoryId = args.data.categoryId ?? null;
      }
      if (args.data.title) {
        candidate.title = args.data.title;
      }
      if (args.data.occurredOn) {
        candidate.occurredOn = new Date(String(args.data.occurredOn));
      }
      if (args.data.amount !== undefined) {
        candidate.amount = Number(args.data.amount);
      }
      if (args.data.status) {
        candidate.status = args.data.status;
      }
      if ('sourceFingerprint' in args.data) {
        candidate.sourceFingerprint = args.data.sourceFingerprint ?? null;
      }
      if ('memo' in args.data) {
        candidate.memo = args.data.memo ?? null;
      }
      candidate.updatedAt = new Date();

      if (!args.select) {
        return candidate;
      }

      const fundingAccount = resolveAccount(candidate.fundingAccountId);
      const category = candidate.categoryId
        ? resolveCategory(candidate.categoryId)
        : null;
      const ledgerTransactionType = resolveLedgerTransactionType(
        candidate.ledgerTransactionTypeId
      );
      const matchedPlanItem = candidate.matchedPlanItemId
        ? findPlanItem(candidate.matchedPlanItemId)
        : null;
      const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
        candidate.id
      );

      return {
        ...(args.select.id ? { id: candidate.id } : {}),
        ...(args.select.occurredOn ? { occurredOn: candidate.occurredOn } : {}),
        ...(args.select.title ? { title: candidate.title } : {}),
        ...(args.select.amount ? { amount: candidate.amount } : {}),
        ...(args.select.status ? { status: candidate.status } : {}),
        ...(args.select.importBatchId
          ? { importBatchId: candidate.importBatchId }
          : {}),
        ...(args.select.matchedPlanItemId
          ? { matchedPlanItemId: candidate.matchedPlanItemId }
          : {}),
        ...(args.select.matchedPlanItem
          ? {
              matchedPlanItem: matchedPlanItem
                ? {
                    ...(args.select.matchedPlanItem.select?.id
                      ? { id: matchedPlanItem.id }
                      : {}),
                    ...(args.select.matchedPlanItem.select?.title
                      ? { title: matchedPlanItem.title }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.postedJournalEntry
          ? {
              postedJournalEntry: postedJournalEntry
                ? {
                    ...(args.select.postedJournalEntry.select?.id
                      ? { id: postedJournalEntry.id }
                      : {}),
                    ...(args.select.postedJournalEntry.select?.entryNumber
                      ? { entryNumber: postedJournalEntry.entryNumber }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.fundingAccount
          ? {
              fundingAccount: {
                ...(args.select.fundingAccount.select?.name
                  ? { name: fundingAccount?.name ?? '' }
                  : {})
              }
            }
          : {}),
        ...(args.select.category
          ? {
              category: category
                ? {
                    ...(args.select.category.select?.name
                      ? { name: category.name }
                      : {})
                  }
                : null
            }
          : {}),
        ...(args.select.ledgerTransactionType
          ? {
              ledgerTransactionType: {
                ...(args.select.ledgerTransactionType.select?.flowKind
                  ? {
                      flowKind:
                        ledgerTransactionType?.flowKind ??
                        LedgerTransactionFlowKind.EXPENSE
                    }
                  : {})
              }
            }
          : {})
      };
    },
    updateMany: async (args: {
      where?: {
        id?: string;
        tenantId?: string;
        ledgerId?: string;
        matchedPlanItemId?: string | null;
        importBatchId?: string | null;
        importedRowId?: string | null;
        status?: {
          in?: CollectedTransactionStatus[];
        };
      };
      data: {
        periodId?: string | null;
        importBatchId?: string | null;
        importedRowId?: string | null;
        ledgerTransactionTypeId?: string;
        fundingAccountId?: string;
        categoryId?: string | null;
        title?: string;
        occurredOn?: Date;
        amount?: number;
        status?: CollectedTransactionStatus;
        sourceFingerprint?: string | null;
        memo?: string | null;
      };
    }) => {
      let updatedCount = 0;

      state.collectedTransactions.forEach((candidate) => {
        if (
          state.simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId ===
          candidate.id
        ) {
          state.simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId =
            null;
          candidate.importBatchId = 'simulated-import-batch';
          candidate.importedRowId = 'simulated-imported-row';
          candidate.updatedAt = new Date();
        }

        const matchesId = !args.where?.id || candidate.id === args.where.id;
        const matchesTenant =
          !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
        const matchesLedger =
          !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
        const matchesMatchedPlanItem =
          args.where?.matchedPlanItemId === undefined ||
          candidate.matchedPlanItemId === args.where.matchedPlanItemId;
        const matchesImportBatch =
          args.where?.importBatchId === undefined ||
          candidate.importBatchId === args.where.importBatchId;
        const matchesImportedRow =
          args.where?.importedRowId === undefined ||
          candidate.importedRowId === args.where.importedRowId;
        const matchesStatus =
          !args.where?.status?.in ||
          args.where.status.in.includes(candidate.status);

        if (
          !(
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesMatchedPlanItem &&
            matchesImportBatch &&
            matchesImportedRow &&
            matchesStatus
          )
        ) {
          return;
        }

        if ('periodId' in args.data) {
          candidate.periodId = args.data.periodId ?? null;
        }
        if ('importBatchId' in args.data) {
          candidate.importBatchId = args.data.importBatchId ?? null;
        }
        if ('importedRowId' in args.data) {
          candidate.importedRowId = args.data.importedRowId ?? null;
        }
        if (args.data.ledgerTransactionTypeId) {
          candidate.ledgerTransactionTypeId = args.data.ledgerTransactionTypeId;
        }
        if (args.data.fundingAccountId) {
          candidate.fundingAccountId = args.data.fundingAccountId;
        }
        if ('categoryId' in args.data) {
          candidate.categoryId = args.data.categoryId ?? null;
        }
        if (args.data.title) {
          candidate.title = args.data.title;
        }
        if (args.data.occurredOn) {
          candidate.occurredOn = new Date(String(args.data.occurredOn));
        }
        if (args.data.amount !== undefined) {
          candidate.amount = Number(args.data.amount);
        }
        if (args.data.status) {
          candidate.status = args.data.status;
        }
        if ('sourceFingerprint' in args.data) {
          candidate.sourceFingerprint = args.data.sourceFingerprint ?? null;
        }
        if ('memo' in args.data) {
          candidate.memo = args.data.memo ?? null;
        }
        candidate.updatedAt = new Date();
        updatedCount += 1;
      });

      return {
        count: updatedCount
      };
    },
    deleteMany: async (args: {
      where?: {
        id?: string | { in?: string[] };
        tenantId?: string;
        ledgerId?: string;
        importBatchId?: string | null;
        status?: {
          in?: CollectedTransactionStatus[];
        };
      };
    }) => {
      const beforeCount = state.collectedTransactions.length;
      state.collectedTransactions = state.collectedTransactions.filter(
        (candidate) => {
          const matchesId =
            !args.where?.id ||
            (typeof args.where.id === 'string'
              ? candidate.id === args.where.id
              : !args.where.id.in || args.where.id.in.includes(candidate.id));
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesImportBatch =
            args.where?.importBatchId === undefined ||
            candidate.importBatchId === args.where.importBatchId;
          const matchesStatus =
            !args.where?.status?.in ||
            args.where.status.in.includes(candidate.status);

          return !(
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesImportBatch &&
            matchesStatus
          );
        }
      );

      return {
        count: beforeCount - state.collectedTransactions.length
      };
    }
  };
}
