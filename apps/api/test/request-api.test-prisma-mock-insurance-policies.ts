import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';
import type { RequestTestState } from './request-api.test-types';

export function createInsurancePoliciesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, resolveAccount, resolveCategory } = context;

  const projectInsurancePolicy = (
    candidate: RequestTestState['insurancePolicies'][number],
    include?: { account?: boolean; category?: boolean }
  ) => {
    const account = candidate.accountId
      ? resolveAccount(candidate.accountId)
      : null;
    const category = candidate.categoryId
      ? resolveCategory(candidate.categoryId)
      : null;

    return {
      ...candidate,
      ...(include
        ? {
            account: include.account ? account : undefined,
            category: include.category ? category : undefined
          }
        : {})
    };
  };

  return {
    insurancePolicy: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const candidate =
          state.insurancePolicies.find((item) => {
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

        return projectInsurancePolicy(candidate, args.include);
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
        include?: { account?: boolean; category?: boolean };
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

        return items.map((candidate) =>
          projectInsurancePolicy(candidate, args.include)
        );
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          accountId?: string | null;
          categoryId?: string | null;
          recurringStartDate?: string | Date | null;
          linkedRecurringRuleId?: string | null;
          provider: string;
          normalizedProvider?: string;
          productName: string;
          normalizedProductName?: string;
          monthlyPremiumWon: number;
          paymentDay: number;
          cycle: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date | null;
          maturityDate?: string | Date | null;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const created = {
          id: `policy-generated-${state.insurancePolicies.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          accountId: args.data.accountId ?? null,
          categoryId: args.data.categoryId ?? null,
          recurringStartDate: args.data.recurringStartDate
            ? new Date(String(args.data.recurringStartDate))
            : null,
          linkedRecurringRuleId: args.data.linkedRecurringRuleId ?? null,
          provider: args.data.provider,
          normalizedProvider: args.data.normalizedProvider,
          productName: args.data.productName,
          normalizedProductName: args.data.normalizedProductName,
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
        return projectInsurancePolicy(created, args.include);
      },
      update: async (args: {
        where: { id: string };
        data: {
          accountId?: string | null;
          categoryId?: string | null;
          recurringStartDate?: string | Date | null;
          linkedRecurringRuleId?: string | null;
          provider?: string;
          normalizedProvider?: string;
          productName?: string;
          normalizedProductName?: string;
          monthlyPremiumWon?: number;
          paymentDay?: number;
          cycle?: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date | null;
          maturityDate?: string | Date | null;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const insurancePolicy = state.insurancePolicies.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!insurancePolicy) {
          throw new Error('Insurance policy not found');
        }

        if ('accountId' in args.data) {
          insurancePolicy.accountId = args.data.accountId ?? null;
        }
        if ('categoryId' in args.data) {
          insurancePolicy.categoryId = args.data.categoryId ?? null;
        }
        if ('recurringStartDate' in args.data) {
          insurancePolicy.recurringStartDate = args.data.recurringStartDate
            ? new Date(String(args.data.recurringStartDate))
            : null;
        }
        if ('linkedRecurringRuleId' in args.data) {
          insurancePolicy.linkedRecurringRuleId =
            args.data.linkedRecurringRuleId ?? null;
        }
        if (args.data.provider !== undefined) {
          insurancePolicy.provider = args.data.provider;
        }
        if (args.data.normalizedProvider !== undefined) {
          insurancePolicy.normalizedProvider = args.data.normalizedProvider;
        }
        if (args.data.productName !== undefined) {
          insurancePolicy.productName = args.data.productName;
        }
        if (args.data.normalizedProductName !== undefined) {
          insurancePolicy.normalizedProductName =
            args.data.normalizedProductName;
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

        return projectInsurancePolicy(insurancePolicy, args.include);
      },
      deleteMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
      }) => {
        const deletedIds = state.insurancePolicies
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

        state.insurancePolicies = state.insurancePolicies.filter(
          (candidate) => !deletedIds.includes(candidate.id)
        );

        return {
          count: deletedIds.length
        };
      }
    }
  };
}
