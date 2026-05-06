import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AuthLinkMaintenanceService,
  buildUnverifiedUserCleanupCutoff
} from '../src/modules/auth/auth-link-maintenance.service';
import type { ApiEnv } from '../src/config/api-env';

const baseEnv = {
  EMAIL_VERIFICATION_TTL: '30m'
} satisfies Pick<ApiEnv, 'EMAIL_VERIFICATION_TTL'>;

test('buildUnverifiedUserCleanupCutoff follows the email verification TTL', () => {
  const cutoff = buildUnverifiedUserCleanupCutoff(
    baseEnv,
    new Date('2026-05-06T00:30:00.000Z')
  );

  assert.equal(cutoff.toISOString(), '2026-05-06T00:00:00.000Z');
});

test('AuthLinkMaintenanceService deletes expired links and stale unverified users', async () => {
  const calls: unknown[] = [];
  const prisma = {
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
      callback({
        user: {
          deleteMany: async (args: unknown) => {
            calls.push({ model: 'user', args });
            return { count: 1 };
          }
        },
        emailVerificationToken: {
          deleteMany: async (args: unknown) => {
            calls.push({ model: 'emailVerificationToken', args });
            return { count: 2 };
          }
        },
        passwordResetToken: {
          deleteMany: async (args: unknown) => {
            calls.push({ model: 'passwordResetToken', args });
            return { count: 3 };
          }
        },
        tenantMembershipInvitation: {
          deleteMany: async (args: unknown) => {
            calls.push({ model: 'tenantMembershipInvitation', args });
            return { count: 4 };
          }
        }
      })
  };
  const now = new Date('2026-05-06T00:30:00.000Z');
  const service = new AuthLinkMaintenanceService(
    prisma as never,
    baseEnv as ApiEnv
  );

  const summary = await service.cleanupExpiredAuthLinks(now);

  assert.deepEqual(summary, {
    unverifiedUserDeletedCount: 1,
    emailVerificationTokenDeletedCount: 2,
    passwordResetTokenDeletedCount: 3,
    tenantInvitationDeletedCount: 4
  });
  assert.deepEqual(calls, [
    {
      model: 'user',
      args: {
        where: {
          emailVerifiedAt: null,
          createdAt: {
            lt: new Date('2026-05-06T00:00:00.000Z')
          },
          authSessions: {
            none: {}
          },
          memberships: {
            none: {}
          },
          emailVerificationTokens: {
            none: {
              consumedAt: null,
              expiresAt: {
                gt: now
              }
            }
          }
        }
      }
    },
    {
      model: 'emailVerificationToken',
      args: {
        where: {
          OR: [
            {
              expiresAt: {
                lt: now
              }
            },
            {
              consumedAt: {
                not: null
              }
            }
          ]
        }
      }
    },
    {
      model: 'passwordResetToken',
      args: {
        where: {
          OR: [
            {
              expiresAt: {
                lt: now
              }
            },
            {
              consumedAt: {
                not: null
              }
            }
          ]
        }
      }
    },
    {
      model: 'tenantMembershipInvitation',
      args: {
        where: {
          OR: [
            {
              expiresAt: {
                lt: now
              }
            },
            {
              acceptedAt: {
                not: null
              }
            },
            {
              revokedAt: {
                not: null
              }
            }
          ]
        }
      }
    }
  ]);
});
