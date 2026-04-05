import {
  AuditActorType,
  CollectedTransactionStatus,
  PlanItemStatus,
  RecurrenceFrequency,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { createAccountingPeriodsPrismaMock } from './request-api.test-prisma-mock-accounting-periods';
import { createAuthPrismaMock } from './request-api.test-prisma-mock-auth';
import { createImportsPrismaMock } from './request-api.test-prisma-mock-imports';
import { createReportingPrismaMock } from './request-api.test-prisma-mock-reporting';
import { createRequestPrismaMockContext } from './request-api.test-prisma-mock-shared';
import { createTransactionsJournalPrismaMock } from './request-api.test-prisma-mock-transactions-journal';
import type { RequestTestState } from './request-api.test-types';

function applyOneShotTransactionSimulations(state: RequestTestState) {
  const collectedTransactionId =
    state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId;

  if (!collectedTransactionId) {
    return;
  }

  state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId = null;

  const collectedTransaction = state.collectedTransactions.find(
    (candidate) => candidate.id === collectedTransactionId
  );

  if (!collectedTransaction) {
    return;
  }

  collectedTransaction.status = CollectedTransactionStatus.POSTED;
  collectedTransaction.updatedAt = new Date();

  const existingJournalEntry = state.journalEntries.find(
    (candidate) =>
      candidate.sourceCollectedTransactionId === collectedTransaction.id
  );

  if (existingJournalEntry) {
    return;
  }

  state.journalEntries.push({
    id: `simulated-journal-entry-${state.journalEntries.length + 1}`,
    tenantId: collectedTransaction.tenantId,
    ledgerId: collectedTransaction.ledgerId,
    periodId: collectedTransaction.periodId ?? 'simulated-period',
    entryNumber: `SIM-${String(state.journalEntries.length + 1).padStart(4, '0')}`,
    entryDate: new Date(collectedTransaction.occurredOn),
    sourceKind: 'COLLECTED_TRANSACTION',
    sourceCollectedTransactionId: collectedTransaction.id,
    reversesJournalEntryId: null,
    correctsJournalEntryId: null,
    correctionReason: null,
    status: 'POSTED',
    memo: collectedTransaction.memo,
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: []
  });
}

export function createPrismaMock(
  state: RequestTestState
): Record<string, unknown> {
  const context = createRequestPrismaMockContext(state);
  const {
    sortTransactions,
    sortRecurringRules,
    findPlanItem,
    resolveAccount,
    resolveCategory
  } = context;

  return {
    $queryRaw: async () => {
      if (!state.databaseReady) {
        throw new Error('Database unavailable');
      }

      return [{ ready: 1 }];
    },
    $transaction: async <T>(
      callback: (tx: Record<string, unknown>) => Promise<T>
    ) => {
      applyOneShotTransactionSimulations(state);
      const transactionState = structuredClone(state);
      const result = await callback(createPrismaMock(transactionState));
      Object.assign(state, transactionState);
      return result;
    },
    ...createAuthPrismaMock(context),
    ...createImportsPrismaMock(context),
    planItem: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
          status?: PlanItemStatus;
          matchedCollectedTransaction?: {
            is?: null;
          };
        };
        select?: {
          id?: boolean;
          title?: boolean;
          plannedAmount?: boolean;
          plannedDate?: boolean;
          fundingAccountId?: boolean;
          ledgerTransactionTypeId?: boolean;
          categoryId?: boolean;
        };
        orderBy?: Array<{
          plannedDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        const items = [...state.planItems]
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              !args.where?.periodId ||
              candidate.periodId === args.where.periodId;
            const matchesStatus =
              args.where?.status === undefined ||
              candidate.status === args.where.status;
            const matchesUnmatched =
              args.where?.matchedCollectedTransaction?.is !== null ||
              !state.collectedTransactions.some(
                (transaction) => transaction.matchedPlanItemId === candidate.id
              );

            return (
              matchesTenant &&
              matchesLedger &&
              matchesPeriod &&
              matchesStatus &&
              matchesUnmatched
            );
          })
          .sort((left, right) => {
            const plannedDateDiff =
              left.plannedDate.getTime() - right.plannedDate.getTime();
            if (plannedDateDiff !== 0) {
              return plannedDateDiff;
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        return items.map((candidate) => {
          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.plannedAmount
              ? { plannedAmount: candidate.plannedAmount }
              : {}),
            ...(args.select.plannedDate
              ? { plannedDate: candidate.plannedDate }
              : {}),
            ...(args.select.fundingAccountId
              ? { fundingAccountId: candidate.fundingAccountId }
              : {}),
            ...(args.select.ledgerTransactionTypeId
              ? { ledgerTransactionTypeId: candidate.ledgerTransactionTypeId }
              : {}),
            ...(args.select.categoryId
              ? { categoryId: candidate.categoryId }
              : {})
          };
        });
      },
      update: async (args: {
        where: {
          id: string;
        };
        data: {
          status?: PlanItemStatus;
        };
      }) => {
        const candidate = findPlanItem(args.where.id);
        if (!candidate) {
          throw new Error('Plan item not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }

        candidate.updatedAt = new Date();
        return candidate;
      }
    },
    ...createAccountingPeriodsPrismaMock(context),
    ...createReportingPrismaMock(context),
    accountSubject: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          code?: { in?: string[] };
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          code?: boolean;
        };
      }) => {
        const items = state.accountSubjects.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesCode =
            !args.where?.code?.in ||
            args.where.code.in.includes(candidate.code);
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesCode && matchesActive;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.code ? { code: candidate.code } : {})
        }));
      }
    },
    ledgerTransactionType: {
      findFirst: async (args: {
        where: {
          tenantId?: string;
          ledgerId?: string;
          code?: string;
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
        };
      }) => {
        const item =
          state.ledgerTransactionTypes.find((candidate) => {
            const matchesTenant =
              !args.where.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesCode =
              !args.where.code || candidate.code === args.where.code;
            const matchesActive =
              args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesTenant && matchesLedger && matchesCode && matchesActive
            );
          }) ?? null;

        if (!item) {
          return null;
        }

        if (args.select?.id) {
          return {
            id: item.id
          };
        }

        return item;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
      }) => {
        return state.ledgerTransactionTypes.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesActive;
        });
      }
    },
    account: {
      findFirst: async (args: {
        where: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
        };
        orderBy?: {
          sortOrder?: 'asc' | 'desc';
        };
        select?: {
          id?: boolean;
          name?: boolean;
          sortOrder?: boolean;
        };
      }) => {
        const account =
          [...state.accounts]
            .filter((candidate) => {
              const matchesId =
                !args.where.id || candidate.id === args.where.id;
              const matchesUser =
                !args.where.userId || candidate.userId === args.where.userId;
              const matchesTenant =
                !args.where.tenantId ||
                candidate.tenantId === args.where.tenantId;
              const matchesLedger =
                !args.where.ledgerId ||
                candidate.ledgerId === args.where.ledgerId;
              const matchesStatus =
                !args.where.status || candidate.status === args.where.status;

              return (
                matchesId &&
                matchesUser &&
                matchesTenant &&
                matchesLedger &&
                matchesStatus
              );
            })
            .sort((left, right) => {
              if (!args.orderBy?.sortOrder) {
                return 0;
              }

              const diff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
              return args.orderBy.sortOrder === 'asc' ? diff : -diff;
            })[0] ?? null;

        if (!account) {
          return null;
        }

        if (!args.select) {
          return account;
        }

        return {
          ...(args.select.id ? { id: account.id } : {}),
          ...(args.select.name ? { name: account.name } : {}),
          ...(args.select.sortOrder
            ? { sortOrder: account.sortOrder ?? 0 }
            : {})
        };
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
        };
        select?: { balanceWon?: boolean };
        orderBy?: Array<{
          status?: 'asc' | 'desc';
          sortOrder?: 'asc' | 'desc';
          name?: 'asc' | 'desc';
        }>;
      }) => {
        const statusOrder = {
          ACTIVE: 0,
          INACTIVE: 1,
          CLOSED: 2
        } as const;
        const items = state.accounts
          .filter((candidate) => {
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesStatus =
              !args.where?.status || candidate.status === args.where.status;

            return (
              matchesUser && matchesTenant && matchesLedger && matchesStatus
            );
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.status) {
                const diff =
                  statusOrder[left.status] - statusOrder[right.status];
                if (diff !== 0) {
                  return order.status === 'asc' ? diff : -diff;
                }
              }

              if (order.sortOrder) {
                const diff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
                if (diff !== 0) {
                  return order.sortOrder === 'asc' ? diff : -diff;
                }
              }

              if (order.name) {
                const diff = left.name.localeCompare(right.name);
                if (diff !== 0) {
                  return order.name === 'asc' ? diff : -diff;
                }
              }
            }

            const sortDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
            if (sortDiff !== 0) {
              return sortDiff;
            }

            return left.name.localeCompare(right.name);
          });

        if (args.select?.balanceWon) {
          return items.map((candidate) => ({
            balanceWon: candidate.balanceWon
          }));
        }

        return items;
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          name: string;
          type: 'BANK' | 'CASH' | 'CARD';
          sortOrder?: number;
        };
      }) => {
        const created = {
          id: `acc-generated-${state.accounts.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          type: args.data.type,
          balanceWon: 0,
          sortOrder: args.data.sortOrder ?? 0,
          status: 'ACTIVE' as const
        };

        state.accounts.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
        };
      }) => {
        const account = state.accounts.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!account) {
          throw new Error('Funding account not found');
        }

        if (args.data.name !== undefined) {
          account.name = args.data.name;
        }
        if (args.data.status !== undefined) {
          account.status = args.data.status;
        }

        return account;
      }
    },
    category: {
      findFirst: async (args: {
        where: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          kind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          name?: boolean;
          kind?: boolean;
          isActive?: boolean;
        };
      }) => {
        const category = state.categories.find(
          (candidate) =>
            (!args.where.id || candidate.id === args.where.id) &&
            (!args.where.userId || candidate.userId === args.where.userId) &&
            (!args.where.tenantId ||
              candidate.tenantId === args.where.tenantId) &&
            (!args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId) &&
            (!args.where.kind || candidate.kind === args.where.kind) &&
            (args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive)
        );

        if (!category) {
          return null;
        }

        if (!args.select) {
          return category;
        }

        return {
          ...(args.select.id ? { id: category.id } : {}),
          ...(args.select.name ? { name: category.name } : {}),
          ...(args.select.kind ? { kind: category.kind } : {}),
          ...(args.select.isActive ? { isActive: category.isActive } : {})
        };
      },
      findMany: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          kind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          isActive?: boolean;
        };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          kind?: 'asc' | 'desc';
          name?: 'asc' | 'desc';
        }>;
      }) => {
        return state.categories
          .filter((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesKind =
              !args.where?.kind || candidate.kind === args.where.kind;
            const matchesActive =
              args.where?.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesId &&
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesKind &&
              matchesActive
            );
          })
          .sort((left, right) => {
            const categoryKindOrder = {
              INCOME: 0,
              EXPENSE: 1,
              TRANSFER: 2
            } as const;

            for (const order of args.orderBy ?? []) {
              if (order.isActive) {
                const activeDiff =
                  Number(right.isActive) - Number(left.isActive);
                if (activeDiff !== 0) {
                  return order.isActive === 'asc' ? -activeDiff : activeDiff;
                }
              }

              if (order.kind) {
                const kindDiff =
                  categoryKindOrder[left.kind ?? 'EXPENSE'] -
                  categoryKindOrder[right.kind ?? 'EXPENSE'];
                if (kindDiff !== 0) {
                  return order.kind === 'asc' ? kindDiff : -kindDiff;
                }
              }

              if (order.name) {
                const nameDiff = left.name.localeCompare(right.name);
                if (nameDiff !== 0) {
                  return order.name === 'asc' ? nameDiff : -nameDiff;
                }
              }
            }

            if (left.kind !== right.kind) {
              return (
                categoryKindOrder[left.kind ?? 'EXPENSE'] -
                categoryKindOrder[right.kind ?? 'EXPENSE']
              );
            }

            return left.name.localeCompare(right.name);
          });
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          name: string;
          kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
        };
      }) => {
        const created = {
          id: `cat-generated-${state.categories.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          kind: args.data.kind,
          isActive: true
        };

        state.categories.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          isActive?: boolean;
        };
      }) => {
        const category = state.categories.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!category) {
          throw new Error('Category not found');
        }

        if (args.data.name !== undefined) {
          category.name = args.data.name;
        }
        if (args.data.isActive !== undefined) {
          category.isActive = args.data.isActive;
        }

        return category;
      }
    },
    ...createTransactionsJournalPrismaMock(context),
    transaction: {
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: TransactionStatus;
        };
        include?: { account?: boolean; category?: boolean };
        select?: { type?: boolean; amountWon?: boolean };
        orderBy?: Array<{
          businessDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.transactions.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;
          return matchesUser && matchesTenant && matchesLedger && matchesStatus;
        });

        items = sortTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.type ? { type: candidate.type } : {}),
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `txn-${state.transactions.length + 1}`,
          userId: String(args.data.userId),
          tenantId: String(args.data.tenantId),
          ledgerId: String(args.data.ledgerId),
          title: String(args.data.title),
          type: args.data.type as TransactionType,
          amountWon: Number(args.data.amountWon),
          businessDate: new Date(String(args.data.businessDate)),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          memo: args.data.memo === undefined ? null : String(args.data.memo),
          origin: args.data.origin as TransactionOrigin,
          status: args.data.status as TransactionStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.transactions.push(created);
        return {
          ...created,
          account,
          category
        };
      }
    },
    recurringRule: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
        select?: {
          id?: boolean;
          title?: boolean;
          accountId?: boolean;
          categoryId?: boolean;
          amountWon?: boolean;
          frequency?: boolean;
          dayOfMonth?: boolean;
          startDate?: boolean;
          endDate?: boolean;
          nextRunDate?: boolean;
          isActive?: boolean;
        };
      }) => {
        const candidate =
          state.recurringRules.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesUser =
              !args.where?.userId || item.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
            const matchesActive =
              args.where?.isActive === undefined ||
              item.isActive === args.where.isActive;

            return (
              matchesId &&
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesActive
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        if (args.select) {
          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.accountId
              ? { accountId: candidate.accountId }
              : {}),
            ...(args.select.categoryId
              ? { categoryId: candidate.categoryId }
              : {}),
            ...(args.select.amountWon
              ? { amountWon: candidate.amountWon }
              : {}),
            ...(args.select.frequency
              ? { frequency: candidate.frequency }
              : {}),
            ...(args.select.dayOfMonth
              ? { dayOfMonth: candidate.dayOfMonth }
              : {}),
            ...(args.select.startDate
              ? { startDate: candidate.startDate }
              : {}),
            ...(args.select.endDate ? { endDate: candidate.endDate } : {}),
            ...(args.select.nextRunDate
              ? { nextRunDate: candidate.nextRunDate }
              : {}),
            ...(args.select.isActive ? { isActive: candidate.isActive } : {})
          };
        }

        const account = resolveAccount(candidate.accountId);
        const category = resolveCategory(candidate.categoryId);

        if (args.include) {
          return {
            ...candidate,
            account: args.include.account ? account : undefined,
            category: args.include.category ? category : undefined
          };
        }

        return candidate;
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
        select?: { amountWon?: boolean };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          nextRunDate?: 'asc' | 'desc';
        }>;
      }) => {
        let items = state.recurringRules.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;
          return matchesUser && matchesTenant && matchesLedger && matchesActive;
        });

        items = sortRecurringRules(items);

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `rr-${state.recurringRules.length + 1}`,
          userId: String(args.data.userId),
          tenantId: String(args.data.tenantId),
          ledgerId: String(args.data.ledgerId),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          title: String(args.data.title),
          amountWon: Number(args.data.amountWon),
          frequency: args.data.frequency as RecurrenceFrequency,
          dayOfMonth: Number(args.data.dayOfMonth),
          startDate: new Date(String(args.data.startDate)),
          endDate:
            args.data.endDate === undefined || args.data.endDate === null
              ? null
              : new Date(String(args.data.endDate)),
          isActive: Boolean(args.data.isActive),
          nextRunDate: new Date(String(args.data.nextRunDate)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.recurringRules.push(created);
        return {
          ...created,
          account,
          category
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          accountId?: string;
          categoryId?: string;
          title?: string;
          amountWon?: number;
          frequency?: RecurrenceFrequency;
          dayOfMonth?: number;
          startDate?: Date;
          endDate?: Date | null;
          isActive?: boolean;
          nextRunDate?: Date;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const candidate = state.recurringRules.find(
          (item) => item.id === args.where.id
        );

        if (!candidate) {
          throw new Error('Recurring rule not found');
        }

        if (args.data.accountId) {
          candidate.accountId = args.data.accountId;
        }
        if (args.data.categoryId) {
          candidate.categoryId = args.data.categoryId;
        }
        if (args.data.title) {
          candidate.title = args.data.title;
        }
        if (args.data.amountWon !== undefined) {
          candidate.amountWon = Number(args.data.amountWon);
        }
        if (args.data.frequency) {
          candidate.frequency = args.data.frequency;
        }
        if (args.data.dayOfMonth !== undefined) {
          candidate.dayOfMonth = args.data.dayOfMonth;
        }
        if (args.data.startDate) {
          candidate.startDate = new Date(String(args.data.startDate));
        }
        if ('endDate' in args.data) {
          candidate.endDate = args.data.endDate
            ? new Date(String(args.data.endDate))
            : null;
        }
        if (args.data.isActive !== undefined) {
          candidate.isActive = args.data.isActive;
        }
        if (args.data.nextRunDate) {
          candidate.nextRunDate = new Date(String(args.data.nextRunDate));
        }
        candidate.updatedAt = new Date();

        const account = resolveAccount(candidate.accountId);
        const category = resolveCategory(candidate.categoryId);

        if (args.include) {
          return {
            ...candidate,
            account: args.include.account ? account : undefined,
            category: args.include.category ? category : undefined
          };
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
        const deletedIds = state.recurringRules
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
          .map((candidate) => candidate.id);

        if (deletedIds.length === 0) {
          return { count: 0 };
        }

        state.recurringRules = state.recurringRules.filter(
          (candidate) => !deletedIds.includes(candidate.id)
        );
        state.planItems = state.planItems.map((candidate) =>
          deletedIds.includes(candidate.recurringRuleId ?? '')
            ? { ...candidate, recurringRuleId: null, updatedAt: new Date() }
            : candidate
        );

        return {
          count: deletedIds.length
        };
      }
    },
    insurancePolicy: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
      }) => {
        return (
          state.insurancePolicies.find((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesActive =
              args.where?.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesId &&
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesActive
            );
          }) ?? null
        );
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          paymentDay?: 'asc' | 'desc';
          provider?: 'asc' | 'desc';
          productName?: 'asc' | 'desc';
        }>;
        select?: { monthlyPremiumWon?: boolean };
      }) => {
        const items = state.insurancePolicies
          .filter((candidate) => {
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesActive =
              args.where?.isActive === undefined ||
              candidate.isActive === args.where.isActive;
            return (
              matchesUser && matchesTenant && matchesLedger && matchesActive
            );
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.isActive) {
                const activeDiff =
                  Number(right.isActive) - Number(left.isActive);
                if (activeDiff !== 0) {
                  return order.isActive === 'asc' ? -activeDiff : activeDiff;
                }
              }

              if (order.paymentDay) {
                const paymentDayDiff = left.paymentDay - right.paymentDay;
                if (paymentDayDiff !== 0) {
                  return order.paymentDay === 'asc'
                    ? paymentDayDiff
                    : -paymentDayDiff;
                }
              }

              if (order.provider) {
                const providerDiff = left.provider.localeCompare(
                  right.provider
                );
                if (providerDiff !== 0) {
                  return order.provider === 'asc'
                    ? providerDiff
                    : -providerDiff;
                }
              }

              if (order.productName) {
                const productNameDiff = left.productName.localeCompare(
                  right.productName
                );
                if (productNameDiff !== 0) {
                  return order.productName === 'asc'
                    ? productNameDiff
                    : -productNameDiff;
                }
              }
            }

            if (left.isActive !== right.isActive) {
              return Number(right.isActive) - Number(left.isActive);
            }

            const paymentDayDiff = left.paymentDay - right.paymentDay;
            if (paymentDayDiff !== 0) {
              return paymentDayDiff;
            }

            const providerDiff = left.provider.localeCompare(right.provider);
            if (providerDiff !== 0) {
              return providerDiff;
            }

            return left.productName.localeCompare(right.productName);
          });

        if (args.select?.monthlyPremiumWon) {
          return items.map((candidate) => ({
            monthlyPremiumWon: candidate.monthlyPremiumWon
          }));
        }

        return items;
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          provider: string;
          productName: string;
          monthlyPremiumWon: number;
          paymentDay: number;
          cycle: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date;
          maturityDate?: string | Date;
          isActive?: boolean;
        };
      }) => {
        const created = {
          id: `policy-generated-${state.insurancePolicies.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          provider: args.data.provider,
          productName: args.data.productName,
          monthlyPremiumWon: Number(args.data.monthlyPremiumWon),
          paymentDay: Number(args.data.paymentDay),
          cycle: args.data.cycle,
          renewalDate: args.data.renewalDate
            ? new Date(String(args.data.renewalDate))
            : null,
          maturityDate: args.data.maturityDate
            ? new Date(String(args.data.maturityDate))
            : null,
          isActive: args.data.isActive ?? true
        };

        state.insurancePolicies.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          provider?: string;
          productName?: string;
          monthlyPremiumWon?: number;
          paymentDay?: number;
          cycle?: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date | null;
          maturityDate?: string | Date | null;
          isActive?: boolean;
        };
      }) => {
        const insurancePolicy = state.insurancePolicies.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!insurancePolicy) {
          throw new Error('Insurance policy not found');
        }

        if (args.data.provider !== undefined) {
          insurancePolicy.provider = args.data.provider;
        }
        if (args.data.productName !== undefined) {
          insurancePolicy.productName = args.data.productName;
        }
        if (args.data.monthlyPremiumWon !== undefined) {
          insurancePolicy.monthlyPremiumWon = Number(
            args.data.monthlyPremiumWon
          );
        }
        if (args.data.paymentDay !== undefined) {
          insurancePolicy.paymentDay = Number(args.data.paymentDay);
        }
        if (args.data.cycle !== undefined) {
          insurancePolicy.cycle = args.data.cycle;
        }
        if ('renewalDate' in args.data) {
          insurancePolicy.renewalDate = args.data.renewalDate
            ? new Date(String(args.data.renewalDate))
            : null;
        }
        if ('maturityDate' in args.data) {
          insurancePolicy.maturityDate = args.data.maturityDate
            ? new Date(String(args.data.maturityDate))
            : null;
        }
        if (args.data.isActive !== undefined) {
          insurancePolicy.isActive = args.data.isActive;
        }

        return insurancePolicy;
      }
    },
    vehicle: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: { fuelLogs?: { orderBy?: { filledOn?: 'asc' | 'desc' } } };
      }) => {
        const candidate =
          state.vehicles.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesUser =
              !args.where?.userId || item.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;

            return matchesId && matchesUser && matchesTenant && matchesLedger;
          }) ?? null;

        if (!candidate) {
          return null;
        }

        return {
          ...candidate,
          fuelLogs: args.include?.fuelLogs
            ? [...candidate.fuelLogs].sort(
                (left, right) =>
                  left.filledOn.getTime() - right.filledOn.getTime()
              )
            : candidate.fuelLogs
        };
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: { fuelLogs?: { orderBy?: { filledOn?: 'asc' | 'desc' } } };
        select?: { monthlyExpenseWon?: boolean };
      }) => {
        const items = state.vehicles.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesUser && matchesTenant && matchesLedger;
        });

        if (args.select?.monthlyExpenseWon) {
          return items.map((candidate) => ({
            monthlyExpenseWon: candidate.monthlyExpenseWon
          }));
        }

        return items.map((candidate) => ({
          ...candidate,
          fuelLogs: args.include?.fuelLogs
            ? [...candidate.fuelLogs].sort(
                (left, right) =>
                  left.filledOn.getTime() - right.filledOn.getTime()
              )
            : candidate.fuelLogs
        }));
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          name: string;
          manufacturer?: string | null;
          fuelType: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm: number;
          monthlyExpenseWon: number;
          estimatedFuelEfficiencyKmPerLiter?: number | null;
        };
        include?: { fuelLogs?: { orderBy?: { filledOn?: 'asc' | 'desc' } } };
      }) => {
        const created = {
          id: `vehicle-generated-${state.vehicles.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          manufacturer: args.data.manufacturer ?? null,
          fuelType: args.data.fuelType,
          initialOdometerKm: Number(args.data.initialOdometerKm),
          monthlyExpenseWon: Number(args.data.monthlyExpenseWon),
          estimatedFuelEfficiencyKmPerLiter:
            args.data.estimatedFuelEfficiencyKmPerLiter ?? null,
          createdAt: new Date(),
          fuelLogs: []
        };

        state.vehicles.push(created);

        return {
          ...created,
          fuelLogs: args.include?.fuelLogs ? [] : created.fuelLogs
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          manufacturer?: string | null;
          fuelType?: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm?: number;
          monthlyExpenseWon?: number;
          estimatedFuelEfficiencyKmPerLiter?: number | null;
        };
        include?: { fuelLogs?: { orderBy?: { filledOn?: 'asc' | 'desc' } } };
      }) => {
        const vehicle = state.vehicles.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!vehicle) {
          throw new Error('Vehicle not found');
        }

        if (args.data.name !== undefined) {
          vehicle.name = args.data.name;
        }
        if ('manufacturer' in args.data) {
          vehicle.manufacturer = args.data.manufacturer ?? null;
        }
        if (args.data.fuelType !== undefined) {
          vehicle.fuelType = args.data.fuelType;
        }
        if (args.data.initialOdometerKm !== undefined) {
          vehicle.initialOdometerKm = Number(args.data.initialOdometerKm);
        }
        if (args.data.monthlyExpenseWon !== undefined) {
          vehicle.monthlyExpenseWon = Number(args.data.monthlyExpenseWon);
        }
        if ('estimatedFuelEfficiencyKmPerLiter' in args.data) {
          vehicle.estimatedFuelEfficiencyKmPerLiter =
            args.data.estimatedFuelEfficiencyKmPerLiter ?? null;
        }

        return {
          ...vehicle,
          fuelLogs: args.include?.fuelLogs
            ? [...vehicle.fuelLogs].sort(
                (left, right) =>
                  left.filledOn.getTime() - right.filledOn.getTime()
              )
            : vehicle.fuelLogs
        };
      }
    },
    vehicleMaintenanceLog: {
      findFirst: async (args: {
        where?: {
          id?: string;
          vehicleId?: string;
          vehicle?: {
            is?: {
              tenantId?: string;
              ledgerId?: string;
            };
          };
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const candidate =
          state.vehicleMaintenanceLogs.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesVehicleId =
              !args.where?.vehicleId || item.vehicleId === args.where.vehicleId;
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) => vehicleCandidate.id === item.vehicleId
              ) ?? null;
            const matchesTenant =
              !args.where?.vehicle?.is?.tenantId ||
              vehicle?.tenantId === args.where.vehicle.is.tenantId;
            const matchesLedger =
              !args.where?.vehicle?.is?.ledgerId ||
              vehicle?.ledgerId === args.where.vehicle.is.ledgerId;

            return (
              matchesId && matchesVehicleId && matchesTenant && matchesLedger
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        const vehicle =
          state.vehicles.find(
            (vehicleCandidate) => vehicleCandidate.id === candidate.vehicleId
          ) ?? null;

        return {
          ...candidate,
          vehicle:
            args.include?.vehicle && vehicle
              ? {
                  ...(args.include.vehicle.select?.id
                    ? { id: vehicle.id }
                    : {}),
                  ...(args.include.vehicle.select?.name
                    ? { name: vehicle.name }
                    : {})
                }
              : vehicle
        };
      },
      findMany: async (args: {
        where?: {
          vehicleId?: string;
          vehicle?: {
            is?: {
              tenantId?: string;
              ledgerId?: string;
            };
          };
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
        orderBy?: Array<{
          performedOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        return [...state.vehicleMaintenanceLogs]
          .filter((candidate) => {
            const matchesVehicleId =
              !args.where?.vehicleId ||
              candidate.vehicleId === args.where.vehicleId;
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) =>
                  vehicleCandidate.id === candidate.vehicleId
              ) ?? null;
            const matchesTenant =
              !args.where?.vehicle?.is?.tenantId ||
              vehicle?.tenantId === args.where.vehicle.is.tenantId;
            const matchesLedger =
              !args.where?.vehicle?.is?.ledgerId ||
              vehicle?.ledgerId === args.where.vehicle.is.ledgerId;

            return matchesVehicleId && matchesTenant && matchesLedger;
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.performedOn) {
                const diff =
                  left.performedOn.getTime() - right.performedOn.getTime();
                if (diff !== 0) {
                  return order.performedOn === 'asc' ? diff : -diff;
                }
              }

              if (order.createdAt) {
                const diff =
                  left.createdAt.getTime() - right.createdAt.getTime();
                if (diff !== 0) {
                  return order.createdAt === 'asc' ? diff : -diff;
                }
              }
            }

            return right.performedOn.getTime() - left.performedOn.getTime();
          })
          .map((candidate) => {
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) =>
                  vehicleCandidate.id === candidate.vehicleId
              ) ?? null;

            return {
              ...candidate,
              vehicle:
                args.include?.vehicle && vehicle
                  ? {
                      ...(args.include.vehicle.select?.id
                        ? { id: vehicle.id }
                        : {}),
                      ...(args.include.vehicle.select?.name
                        ? { name: vehicle.name }
                        : {})
                    }
                  : vehicle
            };
          });
      },
      create: async (args: {
        data: {
          vehicleId: string;
          performedOn: Date;
          odometerKm: number;
          category:
            | 'INSPECTION'
            | 'REPAIR'
            | 'CONSUMABLE'
            | 'TIRE'
            | 'ACCIDENT'
            | 'OTHER';
          vendor?: string | null;
          description: string;
          amountWon: number;
          memo?: string | null;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const vehicle =
          state.vehicles.find(
            (candidate) => candidate.id === args.data.vehicleId
          ) ?? null;

        if (!vehicle) {
          throw new Error('Vehicle not found');
        }

        const created = {
          id: `maintenance-generated-${state.vehicleMaintenanceLogs.length + 1}`,
          vehicleId: args.data.vehicleId,
          performedOn: new Date(String(args.data.performedOn)),
          odometerKm: Number(args.data.odometerKm),
          category: args.data.category,
          vendor: args.data.vendor ?? null,
          description: args.data.description,
          amountWon: Number(args.data.amountWon),
          memo: args.data.memo ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.vehicleMaintenanceLogs.push(created);

        return {
          ...created,
          vehicle: args.include?.vehicle
            ? {
                ...(args.include.vehicle.select?.id ? { id: vehicle.id } : {}),
                ...(args.include.vehicle.select?.name
                  ? { name: vehicle.name }
                  : {})
              }
            : vehicle
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          performedOn?: Date;
          odometerKm?: number;
          category?:
            | 'INSPECTION'
            | 'REPAIR'
            | 'CONSUMABLE'
            | 'TIRE'
            | 'ACCIDENT'
            | 'OTHER';
          vendor?: string | null;
          description?: string;
          amountWon?: number;
          memo?: string | null;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const maintenanceLog = state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!maintenanceLog) {
          throw new Error('Vehicle maintenance log not found');
        }

        if (args.data.performedOn !== undefined) {
          maintenanceLog.performedOn = new Date(String(args.data.performedOn));
        }
        if (args.data.odometerKm !== undefined) {
          maintenanceLog.odometerKm = Number(args.data.odometerKm);
        }
        if (args.data.category !== undefined) {
          maintenanceLog.category = args.data.category;
        }
        if ('vendor' in args.data) {
          maintenanceLog.vendor = args.data.vendor ?? null;
        }
        if (args.data.description !== undefined) {
          maintenanceLog.description = args.data.description;
        }
        if (args.data.amountWon !== undefined) {
          maintenanceLog.amountWon = Number(args.data.amountWon);
        }
        if ('memo' in args.data) {
          maintenanceLog.memo = args.data.memo ?? null;
        }
        maintenanceLog.updatedAt = new Date();

        const vehicle =
          state.vehicles.find(
            (candidate) => candidate.id === maintenanceLog.vehicleId
          ) ?? null;

        return {
          ...maintenanceLog,
          vehicle:
            args.include?.vehicle && vehicle
              ? {
                  ...(args.include.vehicle.select?.id
                    ? { id: vehicle.id }
                    : {}),
                  ...(args.include.vehicle.select?.name
                    ? { name: vehicle.name }
                    : {})
                }
              : vehicle
        };
      }
    }
  };
}
