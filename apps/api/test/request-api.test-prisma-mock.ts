import {
  AuditActorType,
  CollectedTransactionStatus,
  PlanItemStatus,
  RecurrenceFrequency
} from '@prisma/client';
import { createAccountingPeriodsPrismaMock } from './request-api.test-prisma-mock-accounting-periods';
import { createAssetsPrismaMock } from './request-api.test-prisma-mock-assets';
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
  const { sortRecurringRules, findPlanItem, resolveAccount, resolveCategory } =
    context;

  const resolveLinkedInsurancePolicy = (recurringRuleId?: string | null) => {
    if (!recurringRuleId) {
      return null;
    }

    return (
      state.insurancePolicies.find(
        (candidate) => candidate.linkedRecurringRuleId === recurringRuleId
      ) ?? null
    );
  };

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
    recurringRule: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: {
          account?: boolean;
          category?: boolean;
          linkedInsurancePolicy?: {
            select?: {
              id?: boolean;
            };
          };
        };
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
          linkedInsurancePolicy?: {
            select?: {
              id?: boolean;
            };
          };
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
          const linkedInsurancePolicy = resolveLinkedInsurancePolicy(
            candidate.id
          );
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
            ...(args.select.isActive ? { isActive: candidate.isActive } : {}),
            ...(args.select.linkedInsurancePolicy
              ? {
                  linkedInsurancePolicy: linkedInsurancePolicy
                    ? { id: linkedInsurancePolicy.id }
                    : null
                }
              : {})
          };
        }

        const account = resolveAccount(candidate.accountId);
        const category = resolveCategory(candidate.categoryId);
        const linkedInsurancePolicy = resolveLinkedInsurancePolicy(
          candidate.id
        );

        if (args.include) {
          return {
            ...candidate,
            account: args.include.account ? account : undefined,
            category: args.include.category ? category : undefined,
            linkedInsurancePolicy: args.include.linkedInsurancePolicy
              ? linkedInsurancePolicy
                ? { id: linkedInsurancePolicy.id }
                : null
              : undefined
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
        include?: {
          account?: boolean;
          category?: boolean;
          linkedInsurancePolicy?: {
            select?: {
              id?: boolean;
            };
          };
        };
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
          const linkedInsurancePolicy = resolveLinkedInsurancePolicy(
            candidate.id
          );

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined,
              linkedInsurancePolicy: args.include.linkedInsurancePolicy
                ? linkedInsurancePolicy
                  ? { id: linkedInsurancePolicy.id }
                  : null
                : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: {
        data: Record<string, unknown>;
        include?: {
          account?: boolean;
          category?: boolean;
          linkedInsurancePolicy?: {
            select?: {
              id?: boolean;
            };
          };
        };
      }) => {
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
        const linkedInsurancePolicy = resolveLinkedInsurancePolicy(created.id);
        return {
          ...created,
          account: args.include?.account ? account : undefined,
          category: args.include?.category ? category : undefined,
          linkedInsurancePolicy: args.include?.linkedInsurancePolicy
            ? linkedInsurancePolicy
              ? { id: linkedInsurancePolicy.id }
              : null
            : undefined
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
        include?: {
          account?: boolean;
          category?: boolean;
          linkedInsurancePolicy?: {
            select?: {
              id?: boolean;
            };
          };
        };
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
        const linkedInsurancePolicy = resolveLinkedInsurancePolicy(
          candidate.id
        );

        if (args.include) {
          return {
            ...candidate,
            account: args.include.account ? account : undefined,
            category: args.include.category ? category : undefined,
            linkedInsurancePolicy: args.include.linkedInsurancePolicy
              ? linkedInsurancePolicy
                ? { id: linkedInsurancePolicy.id }
                : null
              : undefined
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
        state.insurancePolicies = state.insurancePolicies.map((candidate) =>
          deletedIds.includes(candidate.linkedRecurringRuleId ?? '')
            ? { ...candidate, linkedRecurringRuleId: null }
            : candidate
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
    ...createAssetsPrismaMock(context)
  };
}
