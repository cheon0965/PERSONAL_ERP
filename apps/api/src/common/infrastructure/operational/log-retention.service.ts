import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { ApiEnv } from '../../../config/api-env';
import { getApiEnv } from '../../../config/api-env';
import { PrismaService } from '../../prisma/prisma.service';

const LOG_RETENTION_LOCK_NAME = 'personal_erp_log_retention_schedule';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type MySqlNamedLockResult = {
  acquired: number | bigint | null;
};

export type LogRetentionCutoffs = {
  auditCutoff: Date;
  securityThreatCutoff: Date;
};

@Injectable()
export class LogRetentionService {
  private readonly logger = new Logger(LogRetentionService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 3 * * *', {
    name: 'log-retention-prune',
    timeZone: 'Asia/Seoul'
  })
  async pruneExpiredLogsAtKoreanDawn(): Promise<void> {
    // 여러 API 인스턴스가 떠도 로그 보존 정리는 한 번만 수행되어야 한다.
    // 프로세스 내부 플래그와 MySQL named lock을 함께 사용해 중복 삭제 작업을 막는다.
    const env = getApiEnv();

    if (!env.LOG_RETENTION_SCHEDULE_ENABLED) {
      this.logger.debug('Scheduled log retention pruning is disabled.');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Previous log retention pruning is still running.');
      return;
    }

    this.isRunning = true;
    let lockAcquired = false;

    try {
      lockAcquired = await this.acquireRetentionLock();

      if (!lockAcquired) {
        this.logger.warn(
          'Another API instance is already pruning retained logs. Skipping.'
        );
        return;
      }

      const summary = await this.pruneExpiredLogs(env, new Date());
      this.logger.log(
        [
          'Log retention pruning completed.',
          `workspace audit deleted: ${summary.workspaceAuditDeletedCount}`,
          `security threat deleted: ${summary.securityThreatDeletedCount}`,
          `audit cutoff: ${summary.cutoffs.auditCutoff.toISOString()}`,
          `security cutoff: ${summary.cutoffs.securityThreatCutoff.toISOString()}`
        ].join(' ')
      );
    } catch (error) {
      this.logger.error(
        'Scheduled log retention pruning failed.',
        error instanceof Error ? error.stack : String(error)
      );
    } finally {
      if (lockAcquired) {
        try {
          await this.releaseRetentionLock();
        } catch (error) {
          this.logger.warn(
            `Failed to release log retention lock: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      this.isRunning = false;
    }
  }

  async pruneExpiredLogs(env: ApiEnv, now: Date) {
    const cutoffs = buildLogRetentionCutoffs(env, now);
    // 감사 로그와 보안 위협 로그는 운영 목적이 달라 보존 기간을 독립적으로 적용한다.
    const [workspaceAuditDeleteResult, securityThreatDeleteResult] =
      await this.prisma.$transaction([
        this.prisma.workspaceAuditEvent.deleteMany({
          where: {
            occurredAt: {
              lt: cutoffs.auditCutoff
            }
          }
        }),
        this.prisma.securityThreatEvent.deleteMany({
          where: {
            occurredAt: {
              lt: cutoffs.securityThreatCutoff
            }
          }
        })
      ]);

    return {
      cutoffs,
      workspaceAuditDeletedCount: workspaceAuditDeleteResult.count,
      securityThreatDeletedCount: securityThreatDeleteResult.count
    };
  }

  private async acquireRetentionLock() {
    const [result] = await this.prisma.$queryRaw<MySqlNamedLockResult[]>`
      SELECT GET_LOCK(${LOG_RETENTION_LOCK_NAME}, 0) AS acquired
    `;

    return result?.acquired === 1 || result?.acquired === 1n;
  }

  private async releaseRetentionLock() {
    await this.prisma.$queryRaw`
      SELECT RELEASE_LOCK(${LOG_RETENTION_LOCK_NAME})
    `;
  }
}

export function buildLogRetentionCutoffs(
  env: Pick<
    ApiEnv,
    'WORKSPACE_AUDIT_LOG_RETENTION_DAYS' | 'SECURITY_THREAT_LOG_RETENTION_DAYS'
  >,
  now: Date
): LogRetentionCutoffs {
  return {
    auditCutoff: subtractDays(now, env.WORKSPACE_AUDIT_LOG_RETENTION_DAYS),
    securityThreatCutoff: subtractDays(
      now,
      env.SECURITY_THREAT_LOG_RETENTION_DAYS
    )
  };
}

function subtractDays(moment: Date, days: number): Date {
  return new Date(moment.getTime() - days * MS_PER_DAY);
}
