import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAdminPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    tenantMembershipInvitation: {
      create: async (args: {
        data: {
          tenantId: string;
          email: string;
          normalizedEmail: string;
          role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
          tokenHash: string;
          expiresAt: Date;
          invitedByMembershipId: string;
        };
      }) => {
        const created = {
          id: `tenant-membership-invitation-${state.tenantMembershipInvitations.length + 1}`,
          tenantId: args.data.tenantId,
          email: args.data.email,
          normalizedEmail: args.data.normalizedEmail,
          role: args.data.role,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          acceptedAt: null,
          revokedAt: null,
          invitedByMembershipId: args.data.invitedByMembershipId,
          createdAt: new Date()
        };
        state.tenantMembershipInvitations.push(created);
        return created;
      },
      findFirst: async (args: {
        where?: {
          tenantId?: string;
          normalizedEmail?: string;
          acceptedAt?: null;
          revokedAt?: null;
          expiresAt?: { gt?: Date };
        };
      }) => {
        return (
          state.tenantMembershipInvitations.find((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesEmail =
              !args.where?.normalizedEmail ||
              candidate.normalizedEmail === args.where.normalizedEmail;
            const matchesAccepted =
              args.where?.acceptedAt === undefined ||
              candidate.acceptedAt === args.where.acceptedAt;
            const matchesRevoked =
              args.where?.revokedAt === undefined ||
              candidate.revokedAt === args.where.revokedAt;
            const matchesExpiry =
              !args.where?.expiresAt?.gt ||
              candidate.expiresAt.getTime() > args.where.expiresAt.gt.getTime();

            return (
              matchesTenant &&
              matchesEmail &&
              matchesAccepted &&
              matchesRevoked &&
              matchesExpiry
            );
          }) ?? null
        );
      },
      findUnique: async (args: {
        where: { tokenHash?: string; id?: string };
      }) => {
        return (
          state.tenantMembershipInvitations.find((candidate) => {
            const matchesTokenHash =
              !args.where.tokenHash ||
              candidate.tokenHash === args.where.tokenHash;
            const matchesId = !args.where.id || candidate.id === args.where.id;
            return matchesTokenHash && matchesId;
          }) ?? null
        );
      },
      update: async (args: {
        where: { id: string };
        data: {
          acceptedAt?: Date | null;
          revokedAt?: Date | null;
        };
      }) => {
        const invitation = state.tenantMembershipInvitations.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!invitation) {
          throw new Error('Tenant membership invitation not found');
        }

        Object.assign(invitation, args.data);
        return invitation;
      }
    },
    workspaceAuditEvent: {
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId?: string | null;
          actorUserId?: string | null;
          actorMembershipId?: string | null;
          actorRole?: string | null;
          eventCategory: string;
          eventName: string;
          action?: string | null;
          resourceType?: string | null;
          resourceId?: string | null;
          result: 'SUCCESS' | 'DENIED' | 'FAILED';
          reason?: string | null;
          requestId?: string | null;
          path?: string | null;
          clientIpHash?: string | null;
          metadata?: Record<string, string | number | boolean | null>;
        };
      }) => {
        const created = {
          id: `workspace-audit-event-${state.workspaceAuditEvents.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId ?? null,
          actorUserId: args.data.actorUserId ?? null,
          actorMembershipId: args.data.actorMembershipId ?? null,
          actorRole: args.data.actorRole ?? null,
          eventCategory: args.data.eventCategory,
          eventName: args.data.eventName,
          action: args.data.action ?? null,
          resourceType: args.data.resourceType ?? null,
          resourceId: args.data.resourceId ?? null,
          result: args.data.result,
          reason: args.data.reason ?? null,
          requestId: args.data.requestId ?? null,
          path: args.data.path ?? null,
          clientIpHash: args.data.clientIpHash ?? null,
          metadata: args.data.metadata ?? null,
          occurredAt: new Date()
        };
        state.workspaceAuditEvents.push(created);
        return created;
      },
      count: async (args: { where?: WorkspaceAuditEventWhere }) => {
        return state.workspaceAuditEvents.filter((candidate) =>
          matchesWorkspaceAuditEventWhere(candidate, args.where)
        ).length;
      },
      findMany: async (args: {
        where?: WorkspaceAuditEventWhere;
        skip?: number;
        take?: number;
      }) => {
        const skip = args.skip ?? 0;
        const take = args.take ?? 50;

        return state.workspaceAuditEvents
          .filter((candidate) =>
            matchesWorkspaceAuditEventWhere(candidate, args.where)
          )
          .sort((left, right) => {
            const occurredAtDelta =
              right.occurredAt.getTime() - left.occurredAt.getTime();
            if (occurredAtDelta !== 0) {
              return occurredAtDelta;
            }

            return right.id.localeCompare(left.id);
          })
          .slice(skip, skip + take);
      },
      findFirst: async (args: { where?: WorkspaceAuditEventWhere }) => {
        return (
          state.workspaceAuditEvents.find((candidate) =>
            matchesWorkspaceAuditEventWhere(candidate, args.where)
          ) ?? null
        );
      }
    }
  };
}

type WorkspaceAuditEventWhere = {
  id?: string;
  tenantId?: string;
  eventCategory?: string;
  eventName?: string;
  action?: string;
  result?: 'SUCCESS' | 'DENIED' | 'FAILED';
  actorMembershipId?: string;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  occurredAt?: {
    gte?: Date;
    lte?: Date;
  };
};

function matchesWorkspaceAuditEventWhere(
  candidate: RequestPrismaMockContext['state']['workspaceAuditEvents'][number],
  where: WorkspaceAuditEventWhere | undefined
): boolean {
  const matchesId = !where?.id || candidate.id === where.id;
  const matchesTenant =
    !where?.tenantId || candidate.tenantId === where.tenantId;
  const matchesCategory =
    !where?.eventCategory || candidate.eventCategory === where.eventCategory;
  const matchesEventName =
    !where?.eventName || candidate.eventName === where.eventName;
  const matchesAction = !where?.action || candidate.action === where.action;
  const matchesResult = !where?.result || candidate.result === where.result;
  const matchesActor =
    !where?.actorMembershipId ||
    candidate.actorMembershipId === where.actorMembershipId;
  const matchesResourceType =
    !where?.resourceType || candidate.resourceType === where.resourceType;
  const matchesResourceId =
    !where?.resourceId || candidate.resourceId === where.resourceId;
  const matchesRequest =
    !where?.requestId || candidate.requestId === where.requestId;
  const matchesFrom =
    !where?.occurredAt?.gte ||
    candidate.occurredAt.getTime() >= where.occurredAt.gte.getTime();
  const matchesTo =
    !where?.occurredAt?.lte ||
    candidate.occurredAt.getTime() <= where.occurredAt.lte.getTime();

  return (
    matchesId &&
    matchesTenant &&
    matchesCategory &&
    matchesEventName &&
    matchesAction &&
    matchesResult &&
    matchesActor &&
    matchesResourceType &&
    matchesResourceId &&
    matchesRequest &&
    matchesFrom &&
    matchesTo
  );
}
