import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { ApiEnv } from '../../../../config/api-env';
import { InjectApiEnv } from '../../../../config/api-env.provider';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { getEmailVerificationTtlMs } from './register.handler';

const AUTH_LINK_CLEANUP_LOCK_NAME = 'personal_erp_auth_link_cleanup_schedule';

type MySqlNamedLockResult = {
  acquired: number | bigint | null;
};

type AuthLinkCleanupSummary = {
  unverifiedUserDeletedCount: number;
  emailVerificationTokenDeletedCount: number;
  passwordResetTokenDeletedCount: number;
  tenantInvitationDeletedCount: number;
};

@Injectable()
export class AuthLinkMaintenanceService {
  private readonly logger = new Logger(AuthLinkMaintenanceService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectApiEnv() private readonly env: ApiEnv
  ) {}

  @Cron('15 4 * * *', {
    name: 'auth-link-cleanup',
    timeZone: 'Asia/Seoul'
  })
  async cleanupExpiredAuthLinksAtKoreanDawn(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous auth link cleanup is still running.');
      return;
    }

    this.isRunning = true;
    let lockAcquired = false;

    try {
      lockAcquired = await this.acquireCleanupLock();

      if (!lockAcquired) {
        this.logger.warn(
          'Another API instance is already cleaning up auth links. Skipping.'
        );
        return;
      }

      const summary = await this.cleanupExpiredAuthLinks(new Date());
      this.logger.log(
        [
          'Auth link cleanup completed.',
          `unverified users deleted: ${summary.unverifiedUserDeletedCount}`,
          `email verification tokens deleted: ${summary.emailVerificationTokenDeletedCount}`,
          `password reset tokens deleted: ${summary.passwordResetTokenDeletedCount}`,
          `tenant invitations deleted: ${summary.tenantInvitationDeletedCount}`
        ].join(' ')
      );
    } catch (error) {
      this.logger.error(
        'Scheduled auth link cleanup failed.',
        error instanceof Error ? error.stack : String(error)
      );
    } finally {
      if (lockAcquired) {
        try {
          await this.releaseCleanupLock();
        } catch (error) {
          this.logger.warn(
            `Failed to release auth link cleanup lock: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      this.isRunning = false;
    }
  }

  async cleanupExpiredAuthLinks(now: Date): Promise<AuthLinkCleanupSummary> {
    const unverifiedUserCutoff = buildUnverifiedUserCleanupCutoff(
      this.env,
      now
    );

    return this.prisma.$transaction(async (tx) => {
      const unverifiedUsers = await tx.user.deleteMany({
        where: {
          emailVerifiedAt: null,
          createdAt: {
            lt: unverifiedUserCutoff
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
      });

      const emailVerificationTokens =
        await tx.emailVerificationToken.deleteMany({
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
        });

      const passwordResetTokens = await tx.passwordResetToken.deleteMany({
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
      });

      const tenantInvitations = await tx.tenantMembershipInvitation.deleteMany({
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
      });

      return {
        unverifiedUserDeletedCount: unverifiedUsers.count,
        emailVerificationTokenDeletedCount: emailVerificationTokens.count,
        passwordResetTokenDeletedCount: passwordResetTokens.count,
        tenantInvitationDeletedCount: tenantInvitations.count
      };
    });
  }

  private async acquireCleanupLock(): Promise<boolean> {
    const [result] = await this.prisma.$queryRaw<MySqlNamedLockResult[]>`
      SELECT GET_LOCK(${AUTH_LINK_CLEANUP_LOCK_NAME}, 0) AS acquired
    `;

    return result?.acquired === 1 || result?.acquired === 1n;
  }

  private async releaseCleanupLock(): Promise<void> {
    await this.prisma.$queryRaw`
      SELECT RELEASE_LOCK(${AUTH_LINK_CLEANUP_LOCK_NAME})
    `;
  }
}

export function buildUnverifiedUserCleanupCutoff(
  env: Pick<ApiEnv, 'EMAIL_VERIFICATION_TTL'>,
  now: Date
): Date {
  return new Date(now.getTime() - getEmailVerificationTtlMs(env));
}
