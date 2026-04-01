import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  AuthenticatedWorkspace
} from '@personal-erp/contracts';
import type {
  LedgerStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
  TenantStatus
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedIdentity = Pick<AuthenticatedUser, 'id' | 'email' | 'name'>;

type MembershipRecord = {
  id: string;
  role: TenantMembershipRole;
  status: TenantMembershipStatus;
  tenantId: string;
  joinedAt: Date;
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
    identity: AuthenticatedIdentity
  ): Promise<AuthenticatedUser> {
    const currentWorkspace = await this.resolveCurrentWorkspace(identity.id);

    return {
      id: identity.id,
      email: identity.email,
      name: identity.name,
      currentWorkspace
    };
  }

  async resolveCurrentWorkspace(
    userId: string
  ): Promise<AuthenticatedWorkspace | null> {
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

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: currentMembership.tenantId },
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

    const ledger = await this.resolveCurrentLedger(
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
        id: currentMembership.id,
        role: currentMembership.role,
        status: currentMembership.status
      },
      ledger: ledger
        ? {
            id: ledger.id,
            name: ledger.name,
            baseCurrency: ledger.baseCurrency,
            timezone: ledger.timezone,
            status: ledger.status as LedgerStatus
          }
        : null
    };
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
}

function pickCurrentMembership(
  memberships: MembershipRecord[]
): MembershipRecord | null {
  if (memberships.length === 0) {
    return null;
  }

  const [currentMembership] = [...memberships].sort((left, right) => {
    const roleDelta =
      membershipRoleRank[left.role] - membershipRoleRank[right.role];
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return left.joinedAt.getTime() - right.joinedAt.getTime();
  });

  return currentMembership ?? null;
}
