import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

type MenuItemWhere = {
  tenantId?: string;
  id?: string;
};

type MenuRoleSelectArgs = {
  select?: {
    role?: boolean;
  };
};

function matchesMenuItemWhere(
  candidate: RequestPrismaMockContext['state']['workspaceNavigationMenuItems'][number],
  where: MenuItemWhere | undefined
): boolean {
  const matchesTenant =
    !where?.tenantId || candidate.tenantId === where.tenantId;
  const matchesId = !where?.id || candidate.id === where.id;

  return matchesTenant && matchesId;
}

function sortMenuItems(
  items: RequestPrismaMockContext['state']['workspaceNavigationMenuItems'],
  orderBy:
    | Array<Record<string, 'asc' | 'desc'>>
    | Record<string, 'asc' | 'desc'>
    | undefined
) {
  const normalizedOrderBy = Array.isArray(orderBy)
    ? orderBy
    : orderBy
      ? [orderBy]
      : [];

  return [...items].sort((left, right) => {
    for (const entry of normalizedOrderBy) {
      const sortOrderDirection = entry.sortOrder;
      if (sortOrderDirection && left.sortOrder !== right.sortOrder) {
        const comparison = left.sortOrder - right.sortOrder;
        return sortOrderDirection === 'desc' ? -comparison : comparison;
      }

      const labelDirection = entry.label;
      if (labelDirection && left.label !== right.label) {
        const comparison = left.label.localeCompare(right.label);
        return labelDirection === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });
}

function projectRoles(
  context: RequestPrismaMockContext,
  menuItemId: string,
  args: MenuRoleSelectArgs | undefined
) {
  return context.state.workspaceNavigationMenuRoles
    .filter((candidate) => candidate.menuItemId === menuItemId)
    .map((candidate) =>
      args?.select?.role ? { role: candidate.role } : { ...candidate }
    );
}

export function createNavigationPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    workspaceNavigationMenuItem: {
      findMany: async (args: {
        where?: MenuItemWhere;
        include?: {
          roles?: MenuRoleSelectArgs;
        };
        orderBy?:
          | Array<Record<string, 'asc' | 'desc'>>
          | Record<string, 'asc' | 'desc'>;
      }) => {
        const items = sortMenuItems(
          state.workspaceNavigationMenuItems.filter((candidate) =>
            matchesMenuItemWhere(candidate, args.where)
          ),
          args.orderBy
        );

        return items.map((candidate) => ({
          ...candidate,
          ...(args.include?.roles
            ? {
                roles: projectRoles(context, candidate.id, args.include.roles)
              }
            : {})
        }));
      },
      findFirst: async (args: {
        where?: MenuItemWhere;
        select?: {
          id?: boolean;
        };
      }) => {
        const item =
          state.workspaceNavigationMenuItems.find((candidate) =>
            matchesMenuItemWhere(candidate, args.where)
          ) ?? null;

        if (!item) {
          return null;
        }

        if (args.select) {
          return {
            ...(args.select.id ? { id: item.id } : {})
          };
        }

        return item;
      },
      upsert: async (args: {
        where: {
          tenantId_key: {
            tenantId: string;
            key: string;
          };
        };
        update: Partial<
          Omit<
            RequestPrismaMockContext['state']['workspaceNavigationMenuItems'][number],
            'id' | 'tenantId' | 'key'
          >
        >;
        create: Omit<
          RequestPrismaMockContext['state']['workspaceNavigationMenuItems'][number],
          'id'
        >;
      }) => {
        const existing = state.workspaceNavigationMenuItems.find(
          (candidate) =>
            candidate.tenantId === args.where.tenantId_key.tenantId &&
            candidate.key === args.where.tenantId_key.key
        );

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const nextId =
          state.workspaceNavigationMenuItems.reduce((maxId, candidate) => {
            const match = candidate.id.match(
              /workspace-navigation-menu-item-(\d+)$/
            );

            if (!match) {
              return maxId;
            }

            return Math.max(maxId, Number(match[1]));
          }, 0) + 1;
        const created = {
          id: `workspace-navigation-menu-item-${nextId}`,
          ...args.create
        };
        state.workspaceNavigationMenuItems.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: Partial<
          RequestPrismaMockContext['state']['workspaceNavigationMenuItems'][number]
        >;
      }) => {
        const existing = state.workspaceNavigationMenuItems.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!existing) {
          throw new Error('Workspace navigation menu item not found');
        }

        Object.assign(existing, args.data);
        return existing;
      }
    },
    workspaceNavigationMenuRole: {
      createMany: async (args: {
        data: RequestPrismaMockContext['state']['workspaceNavigationMenuRoles'];
        skipDuplicates?: boolean;
      }) => {
        let count = 0;

        for (const item of args.data) {
          const exists = state.workspaceNavigationMenuRoles.some(
            (candidate) =>
              candidate.menuItemId === item.menuItemId &&
              candidate.role === item.role
          );

          if (exists && args.skipDuplicates) {
            continue;
          }

          if (!exists) {
            state.workspaceNavigationMenuRoles.push({ ...item });
            count += 1;
          }
        }

        return { count };
      },
      deleteMany: async (args: { where?: { menuItemId?: string } }) => {
        const before = state.workspaceNavigationMenuRoles.length;
        state.workspaceNavigationMenuRoles =
          state.workspaceNavigationMenuRoles.filter((candidate) => {
            if (!args.where?.menuItemId) {
              return true;
            }

            return candidate.menuItemId !== args.where.menuItemId;
          });

        return {
          count: before - state.workspaceNavigationMenuRoles.length
        };
      }
    }
  };
}
