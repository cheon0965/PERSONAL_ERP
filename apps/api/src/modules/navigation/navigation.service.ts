import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminPolicySummary,
  AdminPolicySurfaceSection,
  NavigationMenuItem,
  NavigationMenuTreeResponse
} from '@personal-erp/contracts';
import {
  Prisma,
  TenantMembershipRole,
  WorkspaceNavigationMenuItemType
} from '@prisma/client';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { ensureDefaultWorkspaceNavigation } from '../../common/navigation/workspace-navigation-defaults';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateNavigationMenuItemDto } from './dto/update-navigation-menu-item.dto';

type NavigationMenuRecord = Prisma.WorkspaceNavigationMenuItemGetPayload<{
  include: {
    roles: {
      select: {
        role: true;
      };
    };
  };
}>;

type NavigationMenuItemWithRoot = NavigationMenuItem & {
  rootKey: string;
  rootLabel: string;
};

const roleOrder: Record<TenantMembershipRole, number> = {
  OWNER: 0,
  MANAGER: 1,
  EDITOR: 2,
  VIEWER: 3
};

@Injectable()
export class NavigationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessibleTree(
    workspace: RequiredWorkspaceContext
  ): Promise<NavigationMenuTreeResponse> {
    await ensureDefaultWorkspaceNavigation(this.prisma, workspace.tenantId);
    const tree = await this.readTree(workspace.tenantId);

    return {
      items: this.filterByRole(
        tree,
        workspace.membershipRole as TenantMembershipRole
      )
    };
  }

  async getManagementTree(
    workspace: RequiredWorkspaceContext
  ): Promise<NavigationMenuTreeResponse> {
    await ensureDefaultWorkspaceNavigation(this.prisma, workspace.tenantId);

    return {
      items: await this.readTree(workspace.tenantId)
    };
  }

  async updateMenuItem(
    workspace: RequiredWorkspaceContext,
    menuItemId: string,
    input: UpdateNavigationMenuItemDto
  ): Promise<NavigationMenuTreeResponse> {
    await ensureDefaultWorkspaceNavigation(this.prisma, workspace.tenantId);

    const existing = await this.prisma.workspaceNavigationMenuItem.findFirst({
      where: {
        id: menuItemId,
        tenantId: workspace.tenantId
      },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException('메뉴 항목을 찾을 수 없습니다.');
    }

    const allowedRoles = input.allowedRoles
      ? normalizeRoles(input.allowedRoles)
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (input.isVisible !== undefined) {
        await tx.workspaceNavigationMenuItem.update({
          where: { id: menuItemId },
          data: {
            isVisible: input.isVisible
          }
        });
      }

      if (allowedRoles) {
        await tx.workspaceNavigationMenuRole.deleteMany({
          where: { menuItemId }
        });
        await tx.workspaceNavigationMenuRole.createMany({
          data: allowedRoles.map((role) => ({
            menuItemId,
            role
          })),
          skipDuplicates: true
        });
      }
    });

    return this.getManagementTree(workspace);
  }

  async getPolicySummary(
    workspace: RequiredWorkspaceContext
  ): Promise<AdminPolicySummary> {
    const tree = await this.getManagementTree(workspace);
    const items = flattenWithRoot(tree.items)
      .filter((item) => item.href)
      .map((item) => ({
        key: item.key,
        section: mapRootKeyToPolicySection(item.rootKey),
        sectionLabel: item.rootLabel,
        surfaceLabel: item.label,
        href: item.href ?? '',
        description: item.description ?? '',
        allowedRoles: item.allowedRoles,
        ctaPolicy: item.isVisible ? ('ALLOW' as const) : ('HIDE' as const)
      }));

    return { items };
  }

  private async readTree(tenantId: string): Promise<NavigationMenuItem[]> {
    const records = await this.prisma.workspaceNavigationMenuItem.findMany({
      where: { tenantId },
      include: {
        roles: {
          select: {
            role: true
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }]
    });

    return buildTree(records);
  }

  private filterByRole(
    items: NavigationMenuItem[],
    role: TenantMembershipRole
  ): NavigationMenuItem[] {
    return items.flatMap((item) => {
      const isAllowed =
        item.isVisible &&
        item.allowedRoles.includes(role) &&
        item.allowedRoles.length > 0;

      if (!isAllowed) {
        return [];
      }

      const children = this.filterByRole(item.children, role);
      const shouldKeep =
        item.href ||
        children.length > 0 ||
        item.itemType !== WorkspaceNavigationMenuItemType.GROUP;

      if (!shouldKeep) {
        return [];
      }

      return [
        {
          ...item,
          children
        }
      ];
    });
  }
}

function buildTree(records: NavigationMenuRecord[]): NavigationMenuItem[] {
  const nodes = new Map<string, NavigationMenuItem>();
  const roots: NavigationMenuItem[] = [];

  for (const record of records) {
    nodes.set(record.id, mapRecord(record));
  }

  for (const record of records) {
    const node = nodes.get(record.id);
    if (!node) {
      continue;
    }

    if (record.parentId) {
      const parent = nodes.get(record.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  sortAndApplyDepth(roots, 0);
  return roots;
}

function mapRecord(record: NavigationMenuRecord): NavigationMenuItem {
  return {
    id: record.id,
    key: record.key,
    parentId: record.parentId,
    itemType: record.itemType,
    label: record.label,
    description: record.description,
    href: record.href,
    iconKey: record.iconKey,
    matchMode: record.matchMode,
    sortOrder: record.sortOrder,
    depth: 0,
    isVisible: record.isVisible,
    allowedRoles: record.roles
      .map((item) => item.role)
      .sort((left, right) => roleOrder[left] - roleOrder[right]),
    children: []
  };
}

function sortAndApplyDepth(items: NavigationMenuItem[], depth: number): void {
  items.sort((left, right) => {
    const sortDelta = left.sortOrder - right.sortOrder;
    if (sortDelta !== 0) {
      return sortDelta;
    }

    return left.label.localeCompare(right.label);
  });

  for (const item of items) {
    item.depth = depth;
    sortAndApplyDepth(item.children, depth + 1);
  }
}

function flattenWithRoot(
  items: NavigationMenuItem[],
  rootKey?: string,
  rootLabel?: string
): NavigationMenuItemWithRoot[] {
  return items.flatMap((item) => {
    const nextRootKey = rootKey ?? item.key;
    const nextRootLabel = rootLabel ?? item.label;

    return [
      {
        ...item,
        rootKey: nextRootKey,
        rootLabel: nextRootLabel
      },
      ...flattenWithRoot(item.children, nextRootKey, nextRootLabel)
    ];
  });
}

function mapRootKeyToPolicySection(
  rootKey: string
): AdminPolicySurfaceSection {
  switch (rootKey) {
    case 'workflow-monthly':
      return 'MONTHLY_OPERATIONS';
    case 'workflow-assets':
      return 'OPERATING_ASSETS';
    case 'workflow-insights':
      return 'REPORTING';
    case 'workflow-setup':
    default:
      return 'SETTINGS';
  }
}

function normalizeRoles(roles: TenantMembershipRole[]): TenantMembershipRole[] {
  return Array.from(new Set(roles)).sort(
    (left, right) => roleOrder[left] - roleOrder[right]
  );
}
