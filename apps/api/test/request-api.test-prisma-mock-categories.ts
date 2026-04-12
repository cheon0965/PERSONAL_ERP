import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createCategoriesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
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
          normalizedName?: string;
          kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
        };
      }) => {
        const created = {
          id: `cat-generated-${state.categories.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          normalizedName: args.data.normalizedName,
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
          normalizedName?: string;
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
        if (args.data.normalizedName !== undefined) {
          category.normalizedName = args.data.normalizedName;
        }
        if (args.data.isActive !== undefined) {
          category.isActive = args.data.isActive;
        }

        return category;
      }
    }
  };
}
