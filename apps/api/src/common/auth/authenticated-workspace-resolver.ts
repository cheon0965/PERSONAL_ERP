import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  AuthenticatedWorkspace,
  AuthenticatedWorkspaceOption
} from '@personal-erp/contracts';
import type {
  LedgerStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
  TenantStatus
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedIdentity = Pick<
  AuthenticatedUser,
  'id' | 'email' | 'name' | 'isSystemAdmin'
>;

type MembershipRecord = {
  id: string;
  role: TenantMembershipRole;
  status: TenantMembershipStatus;
  tenantId: string;
  joinedAt: Date;
};

export type AuthenticatedSupportContext = {
  tenantId: string | null;
  ledgerId: string | null;
  startedAt: Date | null;
};

export type AuthenticatedWorkspaceSelectionContext = {
  tenantId: string | null;
  ledgerId: string | null;
};

const membershipRoleRank: Record<TenantMembershipRole, number> = {
  OWNER: 0,
  MANAGER: 1,
  EDITOR: 2,
  VIEWER: 3
};

@Injectable()
export class AuthenticatedWorkspaceResolver {
  constructor(private readonly prisma: PrismaService) {}

  async buildAuthenticatedUser(
    identity: AuthenticatedIdentity,
    supportContext?: AuthenticatedSupportContext,
    workspaceSelection?: AuthenticatedWorkspaceSelectionContext
  ): Promise<AuthenticatedUser> {
    const currentWorkspace = await this.resolveCurrentWorkspace(
      identity.id,
      identity.isSystemAdmin ? supportContext : undefined,
      workspaceSelection
    );

    return {
      id: identity.id,
      email: identity.email,
      name: identity.name,
      ...(identity.isSystemAdmin ? { isSystemAdmin: true } : {}),
      currentWorkspace
    };
  }

  async resolveCurrentWorkspace(
    userId: string,
    supportContext?: AuthenticatedSupportContext,
    workspaceSelection?: AuthenticatedWorkspaceSelectionContext
  ): Promise<AuthenticatedWorkspace | null> {
    if (supportContext?.tenantId) {
      const supportWorkspace = await this.resolveSupportWorkspace(
        userId,
        supportContext
      );
      if (supportWorkspace) {
        return supportWorkspace;
      }
    }

    const selectedWorkspace = await this.resolveSelectedWorkspace(
      userId,
      workspaceSelection
    );
    if (selectedWorkspace) {
      return selectedWorkspace;
    }

    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        joinedAt: true
      }
    });

    const currentMembership = pickCurrentMembership(memberships);
    if (!currentMembership) {
      return null;
    }

    return this.buildWorkspaceFromMembership(currentMembership);
  }

  async resolveSelectedWorkspace(
    userId: string,
    workspaceSelection?: AuthenticatedWorkspaceSelectionContext,
    requireSelectedLedger = false
  ): Promise<AuthenticatedWorkspace | null> {
    if (!workspaceSelection?.tenantId) {
      return null;
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId: workspaceSelection.tenantId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        joinedAt: true
      }
    });

    if (!membership) {
      return null;
    }

    return this.buildWorkspaceFromMembership(
      membership,
      workspaceSelection.ledgerId ?? undefined,
      requireSelectedLedger
    );
  }

  async listAccessibleWorkspaces(
    userId: string,
    currentWorkspace?: AuthenticatedWorkspace | null
  ): Promise<AuthenticatedWorkspaceOption[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        joinedAt: true
      }
    });

    const workspaces = await Promise.all(
      sortMemberships(memberships).map((membership) =>
        this.buildWorkspaceFromMembership(membership)
      )
    );

    return workspaces.flatMap((workspace) => {
      if (!workspace) {
        return [];
      }

      return [
        {
          ...workspace,
          isCurrent:
            currentWorkspace?.membership.id === workspace.membership.id &&
            currentWorkspace?.tenant.id === workspace.tenant.id
        }
      ];
    });
  }

  private async resolveCurrentLedger(
    tenantId: string,
    defaultLedgerId?: string
  ): Promise<{
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: LedgerStatus;
  } | null> {
    if (defaultLedgerId) {
      const defaultLedger = await this.prisma.ledger.findUnique({
        where: { id: defaultLedgerId },
        select: {
          id: true,
          name: true,
          baseCurrency: true,
          timezone: true,
          status: true
        }
      });

      if (defaultLedger) {
        return defaultLedger;
      }
    }

    return this.prisma.ledger.findFirst({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        baseCurrency: true,
        timezone: true,
        status: true
      }
    });
  }

  private async resolveSupportWorkspace(
    userId: string,
    supportContext: AuthenticatedSupportContext
  ): Promise<AuthenticatedWorkspace | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: supportContext.tenantId ?? '' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true
      }
    });

    if (!tenant) {
      return null;
    }

    const ledger = supportContext.ledgerId
      ? await this.resolveLedgerById(tenant.id, supportContext.ledgerId)
      : await this.resolveCurrentLedger(
          tenant.id,
          tenant.defaultLedgerId ?? undefined
        );

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status as TenantStatus
      },
      membership: {
        id: `system-admin-support:${userId}`,
        role: 'OWNER',
        status: 'ACTIVE'
      },
      ledger,
      supportContext: {
        enabled: true,
        startedAt: supportContext.startedAt?.toISOString() ?? null
      }
    };
  }

  private async resolveLedgerById(
    tenantId: string,
    ledgerId: string
  ): Promise<AuthenticatedWorkspace['ledger']> {
    const ledger = await this.prisma.ledger.findFirst({
      where: {
        id: ledgerId,
        tenantId
      },
      select: {
        id: true,
        name: true,
        baseCurrency: true,
        timezone: true,
        status: true
      }
    });

    return ledger
      ? {
          id: ledger.id,
          name: ledger.name,
          baseCurrency: ledger.baseCurrency,
          timezone: ledger.timezone,
          status: ledger.status as LedgerStatus
        }
      : null;
  }

  private async buildWorkspaceFromMembership(
    membership: MembershipRecord,
    selectedLedgerId?: string,
    requireSelectedLedger = false
  ): Promise<AuthenticatedWorkspace | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: membership.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true
      }
    });

    if (!tenant) {
      return null;
    }

    const selectedLedger = selectedLedgerId
      ? await this.resolveLedgerById(tenant.id, selectedLedgerId)
      : null;
    if (selectedLedgerId && !selectedLedger && requireSelectedLedger) {
      return null;
    }

    const ledger =
      selectedLedger ??
      (await this.resolveCurrentLedger(
        tenant.id,
        tenant.defaultLedgerId ?? undefined
      ));

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status as TenantStatus
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status
      },
      ledger
    };
  }
}

function pickCurrentMembership(
  memberships: MembershipRecord[]
): MembershipRecord | null {
  if (memberships.length === 0) {
    return null;
  }

  const [currentMembership] = sortMemberships(memberships);

  return currentMembership ?? null;
}

function sortMemberships(memberships: MembershipRecord[]): MembershipRecord[] {
  return [...memberships].sort((left, right) => {
    const roleDelta =
      membershipRoleRank[left.role] - membershipRoleRank[right.role];
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return left.joinedAt.getTime() - right.joinedAt.getTime();
  });
}
