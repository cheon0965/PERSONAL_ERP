import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAuthPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, findUser, projectUser, findTenant, findLedger } = context;
  const matchesMembershipWhere = (
    candidate: RequestPrismaMockContext['state']['memberships'][number],
    where:
      | {
          id?: string;
          userId?: string;
          tenantId?: string;
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
          role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
        }
      | undefined
  ) => {
    const matchesId = !where?.id || candidate.id === where.id;
    const matchesUser = !where?.userId || candidate.userId === where.userId;
    const matchesTenant =
      !where?.tenantId || candidate.tenantId === where.tenantId;
    const matchesStatus = !where?.status || candidate.status === where.status;
    const matchesRole = !where?.role || candidate.role === where.role;
    return (
      matchesId && matchesUser && matchesTenant && matchesStatus && matchesRole
    );
  };
  const projectMembership = (
    membership: RequestPrismaMockContext['state']['memberships'][number],
    args?: {
      select?: {
        id?: boolean;
        role?: boolean;
        status?: boolean;
        tenantId?: boolean;
        joinedAt?: boolean;
      };
      include?: {
        user?: {
          select?: {
            id?: boolean;
            email?: boolean;
            name?: boolean;
            emailVerifiedAt?: boolean;
          };
        };
      };
    }
  ) => {
    if (args?.select) {
      return {
        ...(args.select.id ? { id: membership.id } : {}),
        ...(args.select.role ? { role: membership.role } : {}),
        ...(args.select.status ? { status: membership.status } : {}),
        ...(args.select.tenantId ? { tenantId: membership.tenantId } : {}),
        ...(args.select.joinedAt ? { joinedAt: membership.joinedAt } : {})
      };
    }

    return {
      ...membership,
      ...(args?.include?.user
        ? {
            user: projectUser(
              findUser({ id: membership.userId })!,
              args.include.user.select
            )
          }
        : {})
    };
  };

  return {
    user: {
      findUnique: async (args: {
        where: { email?: string; id?: string };
        select?: {
          id?: boolean;
          email?: boolean;
          name?: boolean;
          passwordHash?: boolean;
          emailVerifiedAt?: boolean;
          createdAt?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
              timezone?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          return null;
        }

        return projectUser(user, args.select);
      },
      create: async (args: {
        data: {
          email: string;
          name: string;
          passwordHash: string;
          settings?: { create?: Record<string, never> };
        };
      }) => {
        if (
          state.users.some((candidate) => candidate.email === args.data.email)
        ) {
          throw new Error('Unique constraint failed on User.email');
        }

        const now = new Date();
        const created = {
          id: `user-${state.users.length + 1}`,
          email: args.data.email,
          name: args.data.name,
          passwordHash: args.data.passwordHash,
          emailVerifiedAt: null,
          createdAt: now,
          settings: args.data.settings
            ? {
                minimumReserveWon: 400_000,
                monthlySinkingFundWon: 140_000,
                timezone: 'Asia/Seoul'
              }
            : undefined
        };
        state.users.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          passwordHash?: string;
          emailVerifiedAt?: Date | null;
        };
      }) => {
        const user = state.users.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!user) {
          throw new Error('User not found');
        }

        Object.assign(user, args.data);
        return user;
      },
      findUniqueOrThrow: async (args: {
        where: { id: string };
        select?: {
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
              timezone?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          throw new Error('User not found');
        }

        return projectUser(user, args.select);
      }
    },
    emailVerificationToken: {
      create: async (args: {
        data: {
          userId: string;
          tokenHash: string;
          expiresAt: Date;
        };
      }) => {
        const created = {
          id: `email-verification-token-${state.emailVerificationTokens.length + 1}`,
          userId: args.data.userId,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          consumedAt: null,
          createdAt: new Date()
        };
        state.emailVerificationTokens.push(created);
        return created;
      },
      findUnique: async (args: {
        where: { tokenHash?: string; id?: string };
        include?: { user?: boolean };
      }) => {
        const token =
          state.emailVerificationTokens.find((candidate) => {
            const { id, tokenHash } = args.where;
            return (
              (!id || candidate.id === id) &&
              (!tokenHash || candidate.tokenHash === tokenHash)
            );
          }) ?? null;

        if (!token) {
          return null;
        }

        return {
          ...token,
          ...(args.include?.user
            ? { user: findUser({ id: token.userId }) ?? null }
            : {})
        };
      },
      update: async (args: {
        where: { id: string };
        data: { consumedAt?: Date | null };
      }) => {
        const token = state.emailVerificationTokens.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!token) {
          throw new Error('Email verification token not found');
        }

        Object.assign(token, args.data);
        return token;
      },
      updateMany: async (args: {
        where: {
          userId?: string;
          consumedAt?: Date | null;
        };
        data: { consumedAt?: Date | null };
      }) => {
        let count = 0;

        state.emailVerificationTokens = state.emailVerificationTokens.map(
          (candidate) => {
            const matchesUser =
              !args.where.userId || candidate.userId === args.where.userId;
            const matchesConsumedAt =
              args.where.consumedAt === undefined ||
              candidate.consumedAt === args.where.consumedAt;

            if (!(matchesUser && matchesConsumedAt)) {
              return candidate;
            }

            count += 1;
            return {
              ...candidate,
              ...args.data
            };
          }
        );

        return { count };
      }
    },
    authSession: {
      create: async (args: {
        data: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        };
      }) => {
        const now = new Date();
        const created = {
          ...args.data,
          revokedAt: null,
          createdAt: now,
          updatedAt: now
        };
        state.authSessions.push(created);
        return created;
      },
      findUnique: async (args: { where: { id: string } }) => {
        return (
          state.authSessions.find(
            (candidate) => candidate.id === args.where.id
          ) ?? null
        );
      },
      findMany: async (args: {
        where?: {
          userId?: string;
        };
      }) => {
        return state.authSessions.filter(
          (candidate) =>
            !args.where?.userId || candidate.userId === args.where.userId
        );
      },
      updateMany: async (args: {
        where: {
          id?: string | { not?: string };
          userId?: string;
          revokedAt?: null;
        };
        data: {
          revokedAt?: Date | null;
        };
      }) => {
        let count = 0;

        state.authSessions = state.authSessions.map((candidate) => {
          const matchesId =
            !args.where.id ||
            (typeof args.where.id === 'string'
              ? candidate.id === args.where.id
              : !args.where.id.not || candidate.id !== args.where.id.not);
          const matchesUser =
            !args.where.userId || candidate.userId === args.where.userId;
          const matchesRevoked =
            args.where.revokedAt === undefined ||
            candidate.revokedAt === args.where.revokedAt;

          if (!(matchesId && matchesUser && matchesRevoked)) {
            return candidate;
          }

          count += 1;
          return {
            ...candidate,
            ...args.data,
            updatedAt: args.data.revokedAt ?? candidate.updatedAt
          };
        });

        return { count };
      }
    },
    tenantMembership: {
      findUnique: async (args: {
        where: {
          id?: string;
          tenantId_userId?: {
            tenantId: string;
            userId: string;
          };
        };
      }) => {
        if (args.where.id) {
          return (
            state.memberships.find(
              (candidate) => candidate.id === args.where.id
            ) ?? null
          );
        }

        if (!args.where.tenantId_userId) {
          return null;
        }

        return (
          state.memberships.find(
            (candidate) =>
              candidate.tenantId === args.where.tenantId_userId?.tenantId &&
              candidate.userId === args.where.tenantId_userId?.userId
          ) ?? null
        );
      },
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          userId?: string;
          role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
        };
        include?: {
          user?: {
            select?: {
              id?: boolean;
              email?: boolean;
              name?: boolean;
              emailVerifiedAt?: boolean;
            };
          };
        };
      }) => {
        const membership =
          state.memberships.find((candidate) =>
            matchesMembershipWhere(candidate, args.where)
          ) ?? null;
        return membership ? projectMembership(membership, args) : null;
      },
      count: async (args: {
        where?: {
          tenantId?: string;
          role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
          id?: { not?: string };
        };
      }) => {
        return state.memberships.filter((candidate) => {
          const matchesId =
            !args.where?.id?.not || candidate.id !== args.where.id.not;
          return (
            matchesId &&
            matchesMembershipWhere(candidate, {
              tenantId: args.where?.tenantId,
              role: args.where?.role,
              status: args.where?.status
            })
          );
        }).length;
      },
      create: async (args: {
        data: {
          tenantId: string;
          userId: string;
          role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
          status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
          invitedByMembershipId?: string | null;
        };
      }) => {
        const created = {
          id: `membership-${state.memberships.length + 1}`,
          tenantId: args.data.tenantId,
          userId: args.data.userId,
          role: args.data.role,
          status: args.data.status,
          joinedAt: new Date(),
          invitedByMembershipId: args.data.invitedByMembershipId ?? null,
          lastAccessAt: null
        };
        state.memberships.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
          status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
          invitedByMembershipId?: string | null;
        };
        include?: {
          user?: {
            select?: {
              id?: boolean;
              email?: boolean;
              name?: boolean;
              emailVerifiedAt?: boolean;
            };
          };
        };
      }) => {
        const membership = state.memberships.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!membership) {
          throw new Error('Tenant membership not found');
        }

        Object.assign(membership, args.data);
        return projectMembership(membership, args);
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
        };
        select?: {
          id?: boolean;
          role?: boolean;
          status?: boolean;
          tenantId?: boolean;
          joinedAt?: boolean;
        };
        include?: {
          user?: {
            select?: {
              id?: boolean;
              email?: boolean;
              name?: boolean;
              emailVerifiedAt?: boolean;
            };
          };
        };
      }) => {
        return state.memberships
          .filter((candidate) => matchesMembershipWhere(candidate, args.where))
          .map((candidate) => projectMembership(candidate, args));
      }
    },
    tenant: {
      findFirst: async (args: {
        where?: {
          memberships?: {
            some?: { userId?: string };
          };
        };
      }) => {
        const userId = args.where?.memberships?.some?.userId;
        if (!userId) {
          return state.tenants[0] ?? null;
        }

        const membership = state.memberships.find(
          (candidate) => candidate.userId === userId
        );
        return membership ? (findTenant(membership.tenantId) ?? null) : null;
      },
      create: async (args: {
        data: {
          slug: string;
          name: string;
          status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
        };
      }) => {
        const created = {
          id: `tenant-${state.tenants.length + 1}`,
          slug: args.data.slug,
          name: args.data.name,
          status: args.data.status,
          defaultLedgerId: null
        };
        state.tenants.push(created);
        return created;
      },
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          slug?: boolean;
          name?: boolean;
          status?: boolean;
          defaultLedgerId?: boolean;
        };
      }) => {
        const tenant = findTenant(args.where.id);
        if (!tenant) {
          return null;
        }

        if (!args.select) {
          return tenant;
        }

        return {
          ...(args.select.id ? { id: tenant.id } : {}),
          ...(args.select.slug ? { slug: tenant.slug } : {}),
          ...(args.select.name ? { name: tenant.name } : {}),
          ...(args.select.status ? { status: tenant.status } : {}),
          ...(args.select.defaultLedgerId
            ? { defaultLedgerId: tenant.defaultLedgerId }
            : {})
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          slug?: string;
          defaultLedgerId?: string | null;
          status?: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
        };
        select?: {
          id?: boolean;
          slug?: boolean;
          name?: boolean;
          status?: boolean;
          defaultLedgerId?: boolean;
        };
      }) => {
        const tenant = state.tenants.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!tenant) {
          throw new Error('Tenant not found');
        }

        Object.assign(tenant, args.data);

        if (!args.select) {
          return tenant;
        }

        return {
          ...(args.select.id ? { id: tenant.id } : {}),
          ...(args.select.slug ? { slug: tenant.slug } : {}),
          ...(args.select.name ? { name: tenant.name } : {}),
          ...(args.select.status ? { status: tenant.status } : {}),
          ...(args.select.defaultLedgerId
            ? { defaultLedgerId: tenant.defaultLedgerId }
            : {})
        };
      }
    },
    ledger: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          tenantId?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
          openedFromYearMonth?: boolean;
          closedThroughYearMonth?: boolean;
        };
      }) => {
        const ledger = findLedger(args.where.id);
        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.tenantId ? { tenantId: ledger.tenantId } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {}),
          ...(args.select.openedFromYearMonth
            ? { openedFromYearMonth: '2026-01' }
            : {}),
          ...(args.select.closedThroughYearMonth
            ? { closedThroughYearMonth: null }
            : {})
        };
      },
      findFirst: async (args: {
        where?: { tenantId?: string };
        select?: {
          id?: boolean;
          tenantId?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
          openedFromYearMonth?: boolean;
          closedThroughYearMonth?: boolean;
        };
      }) => {
        const ledger =
          state.ledgers.find(
            (candidate) =>
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId
          ) ?? null;

        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.tenantId ? { tenantId: ledger.tenantId } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {}),
          ...(args.select.openedFromYearMonth
            ? { openedFromYearMonth: '2026-01' }
            : {}),
          ...(args.select.closedThroughYearMonth
            ? { closedThroughYearMonth: null }
            : {})
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          baseCurrency?: string;
          timezone?: string;
        };
        select?: {
          id?: boolean;
          tenantId?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
          openedFromYearMonth?: boolean;
          closedThroughYearMonth?: boolean;
        };
      }) => {
        const ledger = state.ledgers.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!ledger) {
          throw new Error('Ledger not found');
        }

        Object.assign(ledger, args.data);

        if (!args.select) {
          return {
            ...ledger,
            openedFromYearMonth: '2026-01',
            closedThroughYearMonth: null
          };
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.tenantId ? { tenantId: ledger.tenantId } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {}),
          ...(args.select.openedFromYearMonth
            ? { openedFromYearMonth: '2026-01' }
            : {}),
          ...(args.select.closedThroughYearMonth
            ? { closedThroughYearMonth: null }
            : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          name: string;
          baseCurrency: string;
          timezone: string;
          status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
          openedFromYearMonth: string;
        };
      }) => {
        const created = {
          id: `ledger-${state.ledgers.length + 1}`,
          tenantId: args.data.tenantId,
          name: args.data.name,
          baseCurrency: args.data.baseCurrency,
          timezone: args.data.timezone,
          status: args.data.status,
          createdAt: new Date()
        };
        state.ledgers.push(created);
        return created;
      }
    },
    accountSubject: {
      upsert: async (args: {
        where: { ledgerId_code: { ledgerId: string; code: string } };
        update: {
          name: string;
          statementType: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
          normalSide: 'DEBIT' | 'CREDIT';
          subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
          isSystem: boolean;
          isActive: boolean;
          sortOrder: number;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          code: string;
          name: string;
          statementType: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
          normalSide: 'DEBIT' | 'CREDIT';
          subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
          isSystem: boolean;
          isActive: boolean;
          sortOrder: number;
        };
      }) => {
        const existing = state.accountSubjects.find(
          (candidate) =>
            candidate.ledgerId === args.where.ledgerId_code.ledgerId &&
            candidate.code === args.where.ledgerId_code.code
        );

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          id: `account-subject-${state.accountSubjects.length + 1}`,
          ...args.create
        };
        state.accountSubjects.push(created);
        return created;
      }
    },
    ledgerTransactionType: {
      upsert: async (args: {
        where: { ledgerId_code: { ledgerId: string; code: string } };
        update: {
          name: string;
          flowKind:
            | 'INCOME'
            | 'EXPENSE'
            | 'TRANSFER'
            | 'ADJUSTMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD';
          postingPolicyKey:
            | 'INCOME_BASIC'
            | 'EXPENSE_BASIC'
            | 'TRANSFER_BASIC'
            | 'CARD_SPEND'
            | 'CARD_PAYMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          isActive: boolean;
          sortOrder: number;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          code: string;
          name: string;
          flowKind:
            | 'INCOME'
            | 'EXPENSE'
            | 'TRANSFER'
            | 'ADJUSTMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD';
          postingPolicyKey:
            | 'INCOME_BASIC'
            | 'EXPENSE_BASIC'
            | 'TRANSFER_BASIC'
            | 'CARD_SPEND'
            | 'CARD_PAYMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          isActive: boolean;
          sortOrder: number;
        };
      }) => {
        const existing = state.ledgerTransactionTypes.find(
          (candidate) =>
            candidate.ledgerId === args.where.ledgerId_code.ledgerId &&
            candidate.code === args.where.ledgerId_code.code
        );

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          id: `ledger-transaction-type-${state.ledgerTransactionTypes.length + 1}`,
          ...args.create
        };
        state.ledgerTransactionTypes.push(created);
        return created;
      }
    }
  };
}
