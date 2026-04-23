import { RecurrenceFrequency } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createRecurringRulesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, sortRecurringRules, resolveAccount, resolveCategory } =
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
    recurringRule: {
      count: async (args: {
        where?: {
          accountId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
      }) => {
        return state.recurringRules.filter((candidate) => {
          const matchesAccount =
            !args.where?.accountId ||
            candidate.accountId === args.where.accountId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesAccount && matchesTenant && matchesLedger;
        }).length;
      },
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
    }
  };
}
