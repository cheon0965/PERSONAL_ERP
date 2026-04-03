import {
  AuditActorType,
  CollectedTransactionStatus,
  LedgerTransactionFlowKind
} from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

type JournalEntryInclude = Parameters<
  RequestPrismaMockContext['projectJournalEntry']
>[1];

export function createTransactionsJournalPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    sortCollectedTransactions,
    findAccountingPeriod,
    resolveAccount,
    resolveCategory,
    resolveLedgerTransactionType,
    resolveAccountSubject,
    resolveJournalEntry,
    resolveJournalEntryByCollectedTransaction,
    projectJournalEntry
  } = context;

  return {
    collectedTransaction: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          tenantId?: boolean;
          ledgerId?: boolean;
        };
      }) => {
        const candidate =
          state.collectedTransactions.find(
            (item) => item.id === args.where.id
          ) ?? null;

        if (!candidate) {
          return null;
        }

        if (!args.select) {
          return candidate;
        }

        return {
          ...(args.select.tenantId ? { tenantId: candidate.tenantId } : {}),
          ...(args.select.ledgerId ? { ledgerId: candidate.ledgerId } : {})
        };
      },
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          sourceFingerprint?: string | null;
        };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
          fundingAccountId?: boolean;
          categoryId?: boolean;
          memo?: boolean;
          period?: {
            select?: {
              id?: boolean;
              year?: boolean;
              month?: boolean;
              status?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          category?: {
            select?: {
              name?: boolean;
            };
          };
          ledgerTransactionType?: {
            select?: {
              flowKind?: boolean;
              postingPolicyKey?: boolean;
            };
          };
          postedJournalEntry?: {
            select?: {
              id?: boolean;
              entryNumber?: boolean;
            };
          };
        };
        include?: {
          period?: {
            select?: {
              id?: boolean;
              year?: boolean;
              month?: boolean;
              status?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          category?: {
            select?: {
              name?: boolean;
            };
          };
          ledgerTransactionType?: {
            select?: {
              postingPolicyKey?: boolean;
            };
          };
          postedJournalEntry?: {
            select?: {
              id?: boolean;
            };
          };
        };
      }) => {
        const candidate =
          state.collectedTransactions.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
            const matchesSourceFingerprint =
              args.where?.sourceFingerprint === undefined ||
              item.sourceFingerprint === args.where.sourceFingerprint;

            return (
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesSourceFingerprint
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        const period = candidate.periodId
          ? findAccountingPeriod(candidate.periodId)
          : null;
        const fundingAccount = resolveAccount(candidate.fundingAccountId);
        const category = candidate.categoryId
          ? resolveCategory(candidate.categoryId)
          : null;
        const ledgerTransactionType = resolveLedgerTransactionType(
          candidate.ledgerTransactionTypeId
        );
        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          candidate.id
        );
        const postingPolicyKey =
          candidate.ledgerTransactionTypeId === 'ltt-1-income'
            ? 'INCOME_BASIC'
            : candidate.ledgerTransactionTypeId === 'ltt-1-transfer'
              ? 'TRANSFER_BASIC'
              : 'EXPENSE_BASIC';

        if (args.select) {
          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.occurredOn
              ? { occurredOn: candidate.occurredOn }
              : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.amount ? { amount: candidate.amount } : {}),
            ...(args.select.status ? { status: candidate.status } : {}),
            ...(args.select.importBatchId
              ? { importBatchId: candidate.importBatchId }
              : {}),
            ...(args.select.matchedPlanItemId
              ? { matchedPlanItemId: candidate.matchedPlanItemId }
              : {}),
            ...(args.select.fundingAccountId
              ? { fundingAccountId: candidate.fundingAccountId }
              : {}),
            ...(args.select.categoryId
              ? { categoryId: candidate.categoryId }
              : {}),
            ...(args.select.memo ? { memo: candidate.memo } : {}),
            ...(args.select.period
              ? {
                  period: period
                    ? {
                        ...(args.select.period.select?.id
                          ? { id: period.id }
                          : {}),
                        ...(args.select.period.select?.year
                          ? { year: period.year }
                          : {}),
                        ...(args.select.period.select?.month
                          ? { month: period.month }
                          : {}),
                        ...(args.select.period.select?.status
                          ? { status: period.status }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.fundingAccount
              ? {
                  fundingAccount: {
                    ...(args.select.fundingAccount.select?.id
                      ? { id: fundingAccount?.id ?? '' }
                      : {}),
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
                      : {}),
                    ...(args.select.ledgerTransactionType.select
                      ?.postingPolicyKey
                      ? { postingPolicyKey }
                      : {})
                  }
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
              : {})
          };
        }

        if (!args.include) {
          return candidate;
        }

        return {
          ...candidate,
          ...(args.include.period
            ? {
                period: period
                  ? {
                      ...(args.include.period.select?.id
                        ? { id: period.id }
                        : {}),
                      ...(args.include.period.select?.year
                        ? { year: period.year }
                        : {}),
                      ...(args.include.period.select?.month
                        ? { month: period.month }
                        : {}),
                      ...(args.include.period.select?.status
                        ? { status: period.status }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.include.fundingAccount.select?.id
                    ? { id: fundingAccount?.id ?? '' }
                    : {}),
                  ...(args.include.fundingAccount.select?.name
                    ? { name: fundingAccount?.name ?? '' }
                    : {})
                }
              }
            : {}),
          ...(args.include.category
            ? {
                category: category
                  ? {
                      ...(args.include.category.select?.name
                        ? { name: category.name }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.ledgerTransactionType
            ? {
                ledgerTransactionType: {
                  ...(args.include.ledgerTransactionType.select
                    ?.postingPolicyKey
                    ? { postingPolicyKey }
                    : {})
                }
              }
            : {}),
          ...(args.include.postedJournalEntry
            ? {
                postedJournalEntry: postedJournalEntry
                  ? {
                      ...(args.include.postedJournalEntry.select?.id
                        ? { id: postedJournalEntry.id }
                        : {})
                    }
                  : null
              }
            : {})
        };
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
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
        orderBy?: Array<{
          occurredOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.collectedTransactions.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = sortCollectedTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          const fundingAccount = resolveAccount(candidate.fundingAccountId);
          const category = candidate.categoryId
            ? resolveCategory(candidate.categoryId)
            : null;
          const ledgerTransactionType = resolveLedgerTransactionType(
            candidate.ledgerTransactionTypeId
          );
          const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
            candidate.id
          );

          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.occurredOn
              ? { occurredOn: candidate.occurredOn }
              : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.amount ? { amount: candidate.amount } : {}),
            ...(args.select.status ? { status: candidate.status } : {}),
            ...(args.select.importBatchId
              ? { importBatchId: candidate.importBatchId }
              : {}),
            ...(args.select.matchedPlanItemId
              ? { matchedPlanItemId: candidate.matchedPlanItemId }
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
        });
      },
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
          ledgerTransactionTypeId?: string;
          fundingAccountId?: string;
          categoryId?: string | null;
          title?: string;
          occurredOn?: Date;
          amount?: number;
          status?: CollectedTransactionStatus;
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
        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          candidate.id
        );

        return {
          ...(args.select.id ? { id: candidate.id } : {}),
          ...(args.select.occurredOn
            ? { occurredOn: candidate.occurredOn }
            : {}),
          ...(args.select.title ? { title: candidate.title } : {}),
          ...(args.select.amount ? { amount: candidate.amount } : {}),
          ...(args.select.status ? { status: candidate.status } : {}),
          ...(args.select.importBatchId
            ? { importBatchId: candidate.importBatchId }
            : {}),
          ...(args.select.matchedPlanItemId
            ? { matchedPlanItemId: candidate.matchedPlanItemId }
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
          status?: {
            in?: CollectedTransactionStatus[];
          };
        };
        data: {
          periodId?: string | null;
          ledgerTransactionTypeId?: string;
          fundingAccountId?: string;
          categoryId?: string | null;
          title?: string;
          occurredOn?: Date;
          amount?: number;
          status?: CollectedTransactionStatus;
          memo?: string | null;
        };
      }) => {
        let updatedCount = 0;

        state.collectedTransactions.forEach((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesStatus =
            !args.where?.status?.in ||
            args.where.status.in.includes(candidate.status);

          if (!(matchesId && matchesTenant && matchesLedger && matchesStatus)) {
            return;
          }

          if ('periodId' in args.data) {
            candidate.periodId = args.data.periodId ?? null;
          }
          if (args.data.ledgerTransactionTypeId) {
            candidate.ledgerTransactionTypeId =
              args.data.ledgerTransactionTypeId;
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
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: {
            in?: CollectedTransactionStatus[];
          };
        };
      }) => {
        const beforeCount = state.collectedTransactions.length;
        state.collectedTransactions = state.collectedTransactions.filter(
          (candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesStatus =
              !args.where?.status?.in ||
              args.where.status.in.includes(candidate.status);

            return !(
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesStatus
            );
          }
        );

        return {
          count: beforeCount - state.collectedTransactions.length
        };
      }
    },
    journalEntry: {
      count: async (args: {
        where?: { tenantId?: string; ledgerId?: string; periodId?: string };
      }) => {
        return state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        }).length;
      },
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          sourceCollectedTransactionId?: string | null;
        };
        include?: JournalEntryInclude;
      }) => {
        const candidate = state.journalEntries.find((item) => {
          const matchesId = !args.where?.id || item.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || item.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
          const matchesSourceCollectedTransaction =
            args.where?.sourceCollectedTransactionId === undefined ||
            item.sourceCollectedTransactionId ===
              args.where.sourceCollectedTransactionId;

          return (
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesSourceCollectedTransaction
          );
        });

        if (!candidate) {
          return null;
        }

        if (!args.include) {
          return candidate;
        }

        return projectJournalEntry(candidate, {
          sourceCollectedTransaction: args.include.sourceCollectedTransaction,
          reversesJournalEntry: args.include.reversesJournalEntry,
          reversedByJournalEntry: args.include.reversedByJournalEntry,
          correctsJournalEntry: args.include.correctsJournalEntry,
          correctionEntries: args.include.correctionEntries,
          lines: args.include.lines
        });
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        include?: JournalEntryInclude;
        orderBy?: Array<{
          entryDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = [...items].sort((left, right) => {
          if (left.entryDate.getTime() !== right.entryDate.getTime()) {
            return right.entryDate.getTime() - left.entryDate.getTime();
          }

          return right.createdAt.getTime() - left.createdAt.getTime();
        });

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) =>
          projectJournalEntry(candidate, {
            sourceCollectedTransaction:
              args.include?.sourceCollectedTransaction,
            reversesJournalEntry: args.include?.reversesJournalEntry,
            reversedByJournalEntry: args.include?.reversedByJournalEntry,
            correctsJournalEntry: args.include?.correctsJournalEntry,
            correctionEntries: args.include?.correctionEntries,
            lines: args.include?.lines
          })
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          entryNumber: string;
          entryDate: Date;
          sourceKind:
            | 'COLLECTED_TRANSACTION'
            | 'PLAN_SETTLEMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          sourceCollectedTransactionId?: string;
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
          status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          memo?: string | null;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
          lines: {
            create: Array<{
              lineNumber: number;
              accountSubjectId: string;
              fundingAccountId?: string;
              debitAmount: number;
              creditAmount: number;
              description?: string;
            }>;
          };
        };
        include?: JournalEntryInclude;
      }) => {
        const created = {
          id: `je-${state.journalEntries.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          entryNumber: args.data.entryNumber,
          entryDate: new Date(String(args.data.entryDate)),
          sourceKind: args.data.sourceKind,
          sourceCollectedTransactionId:
            args.data.sourceCollectedTransactionId ?? null,
          reversesJournalEntryId: args.data.reversesJournalEntryId ?? null,
          correctsJournalEntryId: args.data.correctsJournalEntryId ?? null,
          correctionReason: args.data.correctionReason ?? null,
          status: args.data.status,
          memo: args.data.memo ?? null,
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lines: args.data.lines.create.map((line, index) => ({
            id: `jel-${state.journalEntries.length + 1}-${index + 1}`,
            lineNumber: line.lineNumber,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId ?? null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description ?? null
          }))
        };

        state.journalEntries.push(created);

        if (!args.include) {
          return created;
        }

        return projectJournalEntry(created, {
          sourceCollectedTransaction: args.include.sourceCollectedTransaction,
          reversesJournalEntry: args.include.reversesJournalEntry,
          reversedByJournalEntry: args.include.reversedByJournalEntry,
          correctsJournalEntry: args.include.correctsJournalEntry,
          correctionEntries: args.include.correctionEntries,
          lines: args.include.lines
        });
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
        };
      }) => {
        const candidate = resolveJournalEntry(args.where.id);

        if (!candidate) {
          throw new Error('Journal entry not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }

        if ('reversesJournalEntryId' in args.data) {
          candidate.reversesJournalEntryId = args.data.reversesJournalEntryId;
        }

        if ('correctsJournalEntryId' in args.data) {
          candidate.correctsJournalEntryId = args.data.correctsJournalEntryId;
        }

        if ('correctionReason' in args.data) {
          candidate.correctionReason = args.data.correctionReason;
        }

        candidate.updatedAt = new Date();

        return candidate;
      },
      updateMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          status?:
            | 'POSTED'
            | 'REVERSED'
            | 'SUPERSEDED'
            | {
                in?: Array<'POSTED' | 'REVERSED' | 'SUPERSEDED'>;
              };
        };
        data: {
          status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
        };
      }) => {
        let updatedCount = 0;

        state.journalEntries.forEach((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesStatus =
            args.where?.status === undefined
              ? true
              : typeof args.where.status === 'string'
                ? candidate.status === args.where.status
                : !args.where.status.in ||
                  args.where.status.in.includes(candidate.status);

          if (!(matchesId && matchesTenant && matchesLedger && matchesStatus)) {
            return;
          }

          if (args.data.status) {
            candidate.status = args.data.status;
          }

          if ('reversesJournalEntryId' in args.data) {
            candidate.reversesJournalEntryId = args.data.reversesJournalEntryId;
          }

          if ('correctsJournalEntryId' in args.data) {
            candidate.correctsJournalEntryId = args.data.correctsJournalEntryId;
          }

          if ('correctionReason' in args.data) {
            candidate.correctionReason = args.data.correctionReason;
          }

          candidate.updatedAt = new Date();
          updatedCount += 1;
        });

        return {
          count: updatedCount
        };
      }
    },

    journalLine: {
      findMany: async (args: {
        where?: {
          journalEntry?: {
            tenantId?: string;
            ledgerId?: string;
            periodId?: string;
            status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          };
        };
        include?: {
          accountSubject?: {
            select?: {
              id?: boolean;
              code?: boolean;
              name?: boolean;
              subjectKind?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const entries = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.journalEntry?.tenantId ||
            candidate.tenantId === args.where.journalEntry.tenantId;
          const matchesLedger =
            !args.where?.journalEntry?.ledgerId ||
            candidate.ledgerId === args.where.journalEntry.ledgerId;
          const matchesPeriod =
            !args.where?.journalEntry?.periodId ||
            candidate.periodId === args.where.journalEntry.periodId;
          const matchesStatus =
            !args.where?.journalEntry?.status ||
            candidate.status === args.where.journalEntry.status;

          return (
            matchesTenant && matchesLedger && matchesPeriod && matchesStatus
          );
        });

        return entries.flatMap((entry) =>
          entry.lines.map((line) => {
            const accountSubject = resolveAccountSubject(line.accountSubjectId);
            const fundingAccount = line.fundingAccountId
              ? resolveAccount(line.fundingAccountId)
              : null;

            return {
              ...line,
              ...(args.include?.accountSubject
                ? {
                    accountSubject: {
                      ...(args.include.accountSubject.select?.id
                        ? { id: accountSubject?.id ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.code
                        ? { code: accountSubject?.code ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.name
                        ? { name: accountSubject?.name ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.subjectKind
                        ? {
                            subjectKind: accountSubject?.subjectKind ?? 'ASSET'
                          }
                        : {})
                    }
                  }
                : {}),
              ...(args.include?.fundingAccount
                ? {
                    fundingAccount: fundingAccount
                      ? {
                          ...(args.include.fundingAccount.select?.id
                            ? { id: fundingAccount.id }
                            : {}),
                          ...(args.include.fundingAccount.select?.name
                            ? { name: fundingAccount.name }
                            : {})
                        }
                      : null
                  }
                : {})
            };
          })
        );
      }
    }
  };
}
