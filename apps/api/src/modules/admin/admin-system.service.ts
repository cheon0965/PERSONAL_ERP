import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AdminOperationsStatus,
  AdminSupportContext,
  AdminTenantItem,
  AdminTenantDetail,
  AdminTenantLedgerItem,
  AdminUserDetail,
  AdminUserItem,
  AuthenticatedUser,
  RevokeAdminUserSessionsResponse,
  UpdateAdminSupportContextRequest,
  UpdateAdminTenantStatusRequest,
  UpdateAdminUserEmailVerificationRequest,
  UpdateAdminUserStatusRequest,
  UpdateAdminUserSystemAdminRequest
} from '@personal-erp/contracts';
import type { TenantStatus } from '@prisma/client';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { getApiEnv } from '../../config/api-env';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  mapAdminAuditEventToItem,
  mapAdminSecurityThreatEventToItem
} from './admin.mapper';

type SystemTenantRecord = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  defaultLedgerId: string | null;
};

type SystemTenantListRecord = SystemTenantRecord & {
  defaultLedger: {
    id: string;
    name: string;
  } | null;
  ledgers: Array<{
    id: string;
  }>;
  memberships: Array<{
    role: string;
    status: string;
  }>;
};

type SystemUserListRecord = {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  lockedReason: string | null;
  lockedAt: Date | null;
  isSystemAdmin: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  memberships: Array<{
    status: string;
  }>;
  authSessions: Array<{
    expiresAt: Date;
    revokedAt: Date | null;
  }>;
};

@Injectable()
export class AdminSystemService {
  constructor(private readonly prisma: PrismaService) {}

  assertSystemAdmin(user: AuthenticatedUser): void {
    if (user.isSystemAdmin) {
      return;
    }

    throw new ForbiddenException('전역 관리자만 사용할 수 있는 기능입니다.');
  }

  async findTenants(): Promise<AdminTenantItem[]> {
    const tenants = await this.findTenantRecords();
    return tenants.map(mapSystemTenantToItem);
  }

  private async findTenantRecords(): Promise<SystemTenantListRecord[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true,
        defaultLedger: {
          select: {
            id: true,
            name: true
          }
        },
        ledgers: {
          select: {
            id: true
          }
        },
        memberships: {
          select: {
            role: true,
            status: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }]
    });

    return tenants;
  }

  async findUsers(): Promise<AdminUserItem[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lockedReason: true,
        lockedAt: true,
        isSystemAdmin: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            status: true
          }
        },
        authSessions: {
          select: {
            expiresAt: true,
            revokedAt: true
          }
        }
      },
      orderBy: [{ isSystemAdmin: 'desc' }, { createdAt: 'asc' }]
    });

    return users.map((user) => mapSystemUserToItem(user, new Date()));
  }

  async findUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lockedReason: true,
        lockedAt: true,
        isSystemAdmin: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true
              }
            }
          }
        },
        authSessions: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
            revokedAt: true,
            supportTenantId: true,
            supportLedgerId: true,
            supportStartedAt: true
          },
          orderBy: [{ revokedAt: 'asc' }, { updatedAt: 'desc' }],
          take: 20
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const recentSecurityThreats =
      await this.prisma.securityThreatEvent.findMany({
        where: { userId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 10
      });

    return {
      ...mapSystemUserToItem(
        {
          ...user,
          authSessions: user.authSessions
        },
        new Date()
      ),
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        tenantId: membership.tenant.id,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt.toISOString()
      })),
      sessions: user.authSessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        supportTenantId: session.supportTenantId,
        supportLedgerId: session.supportLedgerId,
        supportStartedAt: session.supportStartedAt?.toISOString() ?? null
      })),
      recentSecurityThreats: recentSecurityThreats.map(
        mapAdminSecurityThreatEventToItem
      )
    };
  }

  async updateUserStatus(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateAdminUserStatusRequest
  ): Promise<AdminUserDetail> {
    const user = await this.requireUser(userId);
    if (actor.id === userId && input.status !== 'ACTIVE') {
      throw new BadRequestException('자기 자신의 계정은 잠글 수 없습니다.');
    }

    if (user.isSystemAdmin && input.status !== 'ACTIVE') {
      await this.assertAnotherActiveSystemAdmin(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: input.status,
        lockedReason:
          input.status === 'ACTIVE' ? null : input.reason?.trim() || null,
        lockedAt: input.status === 'ACTIVE' ? null : new Date()
      }
    });

    return this.findUserDetail(userId);
  }

  async revokeUserSessions(
    actor: AuthenticatedUser,
    userId: string,
    currentSessionId: string | undefined
  ): Promise<RevokeAdminUserSessionsResponse> {
    await this.requireUser(userId);
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(actor.id === userId && currentSessionId
          ? { id: { not: currentSessionId } }
          : {})
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { revokedCount: result.count };
  }

  async updateUserSystemAdmin(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateAdminUserSystemAdminRequest
  ): Promise<AdminUserDetail> {
    const user = await this.requireUser(userId);
    if (actor.id === userId) {
      throw new BadRequestException(
        '자기 자신의 전체 관리자 권한은 변경할 수 없습니다.'
      );
    }

    if (user.isSystemAdmin && !input.isSystemAdmin) {
      await this.assertAnotherActiveSystemAdmin(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isSystemAdmin: input.isSystemAdmin }
    });

    return this.findUserDetail(userId);
  }

  async updateUserEmailVerification(
    userId: string,
    input: UpdateAdminUserEmailVerificationRequest
  ): Promise<AdminUserDetail> {
    if (!input.emailVerified) {
      throw new BadRequestException('이메일 인증 해제는 지원하지 않습니다.');
    }

    await this.requireUser(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() }
    });

    return this.findUserDetail(userId);
  }

  async findTenantDetail(tenantId: string): Promise<AdminTenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true,
        defaultLedger: {
          select: {
            id: true,
            name: true
          }
        },
        ledgers: {
          select: {
            id: true,
            name: true,
            baseCurrency: true,
            timezone: true,
            status: true
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
        },
        memberships: {
          select: {
            role: true,
            status: true
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException('Workspace tenant not found');
    }

    const recentAuditEvents = await this.prisma.workspaceAuditEvent.findMany({
      where: { tenantId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 10
    });

    return {
      ...mapSystemTenantToItem(tenant),
      ledgers: tenant.ledgers.map(mapLedgerToItem),
      recentAuditEvents: recentAuditEvents.map(mapAdminAuditEventToItem),
      recentSecurityThreats: []
    };
  }

  async updateTenantStatus(
    tenantId: string,
    input: UpdateAdminTenantStatusRequest
  ): Promise<AdminTenantDetail> {
    if (input.status === 'ACTIVE') {
      const ledgerCount = await this.prisma.ledger.count({
        where: { tenantId }
      });
      if (ledgerCount < 1) {
        throw new BadRequestException(
          '활성화하려면 최소 1개의 장부가 필요합니다.'
        );
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: input.status }
    });

    return this.findTenantDetail(tenantId);
  }

  async findSupportContext(sessionId: string): Promise<AdminSupportContext> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: {
        supportTenantId: true,
        supportLedgerId: true,
        supportStartedAt: true
      }
    });

    if (!session?.supportTenantId) {
      return createEmptySupportContext();
    }

    return this.buildSupportContext(
      session.supportTenantId,
      session.supportLedgerId,
      session.supportStartedAt
    );
  }

  async updateSupportContext(
    sessionId: string,
    input: UpdateAdminSupportContextRequest
  ): Promise<AdminSupportContext> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        id: true,
        defaultLedgerId: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Workspace tenant not found');
    }

    const ledger = input.ledgerId
      ? await this.prisma.ledger.findFirst({
          where: { id: input.ledgerId, tenantId: tenant.id },
          select: { id: true }
        })
      : await this.resolveTenantLedger(tenant.id, tenant.defaultLedgerId);

    if (!ledger) {
      throw new NotFoundException('Workspace ledger not found');
    }

    const startedAt = new Date();
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        supportTenantId: tenant.id,
        supportLedgerId: ledger.id,
        supportStartedAt: startedAt
      }
    });

    return this.buildSupportContext(tenant.id, ledger.id, startedAt);
  }

  async clearSupportContext(sessionId: string): Promise<AdminSupportContext> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        supportTenantId: null,
        supportLedgerId: null,
        supportStartedAt: null
      }
    });

    return createEmptySupportContext();
  }

  async getOperationsStatus(): Promise<AdminOperationsStatus> {
    const checkedAt = new Date();
    const since = new Date(checkedAt.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      lockedUsers,
      totalTenants,
      activeTenants,
      suspendedTenants,
      highThreats24h,
      failedAuditEvents24h,
      recentSecurityThreats,
      recentAuditEvents
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: { not: 'ACTIVE' } } }),
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.securityThreatEvent.count({
        where: {
          severity: { in: ['HIGH', 'CRITICAL'] },
          occurredAt: { gte: since }
        }
      }),
      this.prisma.workspaceAuditEvent.count({
        where: {
          result: { in: ['DENIED', 'FAILED'] },
          occurredAt: { gte: since }
        }
      }),
      this.prisma.securityThreatEvent.findMany({
        where: { severity: { in: ['HIGH', 'CRITICAL'] } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 8
      }),
      this.prisma.workspaceAuditEvent.findMany({
        where: { result: { in: ['DENIED', 'FAILED'] } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 8
      })
    ]);

    const databaseComponent = await this.readDatabaseComponent();
    const env = getApiEnv();

    return {
      checkedAt: checkedAt.toISOString(),
      components: [
        {
          key: 'api',
          label: 'API',
          status: 'OK',
          message: '관리자 API가 응답했습니다.'
        },
        databaseComponent,
        {
          key: 'prisma',
          label: 'Prisma migration',
          status: 'UNKNOWN',
          message:
            '운영 DB migration 상세 비교는 배포 절차에서 별도 확인합니다.'
        },
        {
          key: 'mail',
          label: '메일 발송 설정',
          status: env.MAIL_PROVIDER ? 'OK' : 'WARNING',
          message: `${env.MAIL_PROVIDER} provider로 설정되어 있습니다.`
        },
        {
          key: 'security-threats',
          label: '보안 위협',
          status: highThreats24h > 0 ? 'WARNING' : 'OK',
          message: `최근 24시간 긴급/높음 위협 ${highThreats24h}건`
        },
        {
          key: 'audit-failures',
          label: '감사 실패/거부',
          status: failedAuditEvents24h > 0 ? 'WARNING' : 'OK',
          message: `최근 24시간 실패/거부 감사 이벤트 ${failedAuditEvents24h}건`
        }
      ],
      metrics: {
        totalUsers,
        lockedUsers,
        totalTenants,
        activeTenants,
        suspendedTenants,
        highThreats24h,
        failedAuditEvents24h
      },
      recentSecurityThreats: recentSecurityThreats.map(
        mapAdminSecurityThreatEventToItem
      ),
      recentAuditEvents: recentAuditEvents.map(mapAdminAuditEventToItem)
    };
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isSystemAdmin: true,
        status: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async assertAnotherActiveSystemAdmin(userId: string): Promise<void> {
    const activeSystemAdminCount = await this.prisma.user.count({
      where: {
        id: { not: userId },
        isSystemAdmin: true,
        status: 'ACTIVE'
      }
    });

    if (activeSystemAdminCount < 1) {
      throw new BadRequestException(
        '최소 1명의 활성 전체 관리자가 남아 있어야 합니다.'
      );
    }
  }

  private async buildSupportContext(
    tenantId: string,
    ledgerId: string | null,
    startedAt: Date | null
  ): Promise<AdminSupportContext> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true,
        defaultLedger: {
          select: {
            id: true,
            name: true
          }
        },
        ledgers: {
          select: {
            id: true
          }
        },
        memberships: {
          select: {
            role: true,
            status: true
          }
        }
      }
    });

    if (!tenant) {
      return createEmptySupportContext();
    }

    const ledger = ledgerId
      ? await this.prisma.ledger.findFirst({
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
        })
      : null;

    return {
      enabled: true,
      tenant: mapSystemTenantToItem(tenant),
      ledger: ledger ? mapLedgerToItem(ledger) : null,
      startedAt: startedAt?.toISOString() ?? null
    };
  }

  private async readDatabaseComponent(): Promise<
    AdminOperationsStatus['components'][number]
  > {
    try {
      await this.prisma.user.count();
      return {
        key: 'database',
        label: 'DB',
        status: 'OK',
        message: 'DB 읽기 점검이 성공했습니다.'
      };
    } catch (error) {
      return {
        key: 'database',
        label: 'DB',
        status: 'ERROR',
        message:
          error instanceof Error
            ? `DB 읽기 점검 실패: ${error.message}`
            : 'DB 읽기 점검에 실패했습니다.'
      };
    }
  }

  async resolveWorkspaceForMembership(
    user: AuthenticatedUser,
    membershipId: string
  ): Promise<RequiredWorkspaceContext> {
    this.assertSystemAdmin(user);
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: membershipId },
      select: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            defaultLedgerId: true
          }
        }
      }
    });

    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }

    return this.buildSystemWorkspace(user, membership.tenant);
  }

  async resolveWorkspaceForTenant(
    user: AuthenticatedUser,
    tenantId: string
  ): Promise<RequiredWorkspaceContext> {
    this.assertSystemAdmin(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        defaultLedgerId: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Workspace tenant not found');
    }

    return this.buildSystemWorkspace(user, tenant);
  }

  private async buildSystemWorkspace(
    user: AuthenticatedUser,
    tenant: SystemTenantRecord
  ): Promise<RequiredWorkspaceContext> {
    const ledger = await this.resolveTenantLedger(
      tenant.id,
      tenant.defaultLedgerId
    );

    if (!ledger) {
      throw new NotFoundException('Workspace ledger not found');
    }

    return {
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      membershipId: `system-admin:${user.id}`,
      membershipRole: 'OWNER',
      systemRole: 'SYSTEM_ADMIN',
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      baseCurrency: ledger.baseCurrency,
      timezone: ledger.timezone
    };
  }

  private async resolveTenantLedger(
    tenantId: string,
    defaultLedgerId: string | null
  ): Promise<{
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
  } | null> {
    if (defaultLedgerId) {
      const defaultLedger = await this.prisma.ledger.findUnique({
        where: { id: defaultLedgerId },
        select: {
          id: true,
          name: true,
          baseCurrency: true,
          timezone: true
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
        timezone: true
      }
    });
  }
}

function mapSystemTenantToItem(
  tenant: SystemTenantListRecord
): AdminTenantItem {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    defaultLedgerId: tenant.defaultLedgerId,
    defaultLedgerName: tenant.defaultLedger?.name ?? null,
    ledgerCount: tenant.ledgers.length,
    memberCount: tenant.memberships.length,
    activeMemberCount: tenant.memberships.filter(
      (membership) => membership.status === 'ACTIVE'
    ).length,
    ownerCount: tenant.memberships.filter(
      (membership) =>
        membership.role === 'OWNER' && membership.status === 'ACTIVE'
    ).length
  };
}

function mapSystemUserToItem(
  user: SystemUserListRecord,
  now: Date
): AdminUserItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    lockedReason: user.lockedReason,
    lockedAt: user.lockedAt?.toISOString() ?? null,
    isSystemAdmin: user.isSystemAdmin,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
    sessionCount: user.authSessions.length,
    activeSessionCount: user.authSessions.filter(
      (session) =>
        session.revokedAt === null && session.expiresAt.getTime() > now.getTime()
    ).length,
    membershipCount: user.memberships.length,
    activeMembershipCount: user.memberships.filter(
      (membership) => membership.status === 'ACTIVE'
    ).length
  };
}

function mapLedgerToItem(ledger: {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
  status: AdminTenantLedgerItem['status'];
}): AdminTenantLedgerItem {
  return {
    id: ledger.id,
    name: ledger.name,
    baseCurrency: ledger.baseCurrency,
    timezone: ledger.timezone,
    status: ledger.status
  };
}

function createEmptySupportContext(): AdminSupportContext {
  return {
    enabled: false,
    tenant: null,
    ledger: null,
    startedAt: null
  };
}
