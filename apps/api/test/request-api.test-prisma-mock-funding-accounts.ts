import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createFundingAccountsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    account: {
      findFirst: async (args: {
        where: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
        };
        orderBy?: {
          sortOrder?: 'asc' | 'desc';
        };
        select?: {
          id?: boolean;
          name?: boolean;
          type?: boolean;
          status?: boolean;
          bootstrapStatus?: boolean;
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
              const matchesBootstrapStatus =
                !args.where.bootstrapStatus ||
                (candidate.bootstrapStatus ?? 'NOT_REQUIRED') ===
                  args.where.bootstrapStatus;

              return (
                matchesId &&
                matchesUser &&
                matchesTenant &&
                matchesLedger &&
                matchesStatus &&
                matchesBootstrapStatus
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
          ...(args.select.type ? { type: account.type } : {}),
          ...(args.select.status ? { status: account.status } : {}),
          ...(args.select.bootstrapStatus
            ? { bootstrapStatus: account.bootstrapStatus ?? 'NOT_REQUIRED' }
            : {}),
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
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
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
            const matchesBootstrapStatus =
              !args.where?.bootstrapStatus ||
              (candidate.bootstrapStatus ?? 'NOT_REQUIRED') ===
                args.where.bootstrapStatus;

            return (
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesStatus &&
              matchesBootstrapStatus
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
          normalizedName?: string;
          type: 'BANK' | 'CASH' | 'CARD';
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
          sortOrder?: number;
        };
      }) => {
        const created = {
          id: `acc-generated-${state.accounts.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          normalizedName: args.data.normalizedName,
          type: args.data.type,
          balanceWon: 0,
          sortOrder: args.data.sortOrder ?? 0,
          status: 'ACTIVE' as const,
          bootstrapStatus:
            args.data.bootstrapStatus ??
            (args.data.type === 'BANK' || args.data.type === 'CARD'
              ? 'PENDING'
              : 'NOT_REQUIRED')
        };

        state.accounts.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          normalizedName?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
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
        if (args.data.normalizedName !== undefined) {
          account.normalizedName = args.data.normalizedName;
        }
        if (args.data.status !== undefined) {
          account.status = args.data.status;
        }
        if (args.data.bootstrapStatus !== undefined) {
          account.bootstrapStatus = args.data.bootstrapStatus;
        }

        return account;
      },
      updateMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
        };
        data: {
          bootstrapStatus?: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';
        };
      }) => {
        let updatedCount = 0;

        state.accounts.forEach((account) => {
          const matchesId = !args.where?.id || account.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || account.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || account.ledgerId === args.where.ledgerId;
          const matchesBootstrapStatus =
            !args.where?.bootstrapStatus ||
            (account.bootstrapStatus ?? 'NOT_REQUIRED') ===
              args.where.bootstrapStatus;

          if (
            !(
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesBootstrapStatus
            )
          ) {
            return;
          }

          if (args.data.bootstrapStatus !== undefined) {
            account.bootstrapStatus = args.data.bootstrapStatus;
          }
          updatedCount += 1;
        });

        return {
          count: updatedCount
        };
      }
    }
  };
}
