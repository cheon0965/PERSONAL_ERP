import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getApiEnv } from '../../config/api-env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { seedDemoData } from '../../../prisma/seed';

const DEMO_RESET_LOCK_NAME = 'personal_erp_demo_reset_schedule';

type MySqlNamedLockResult = {
  acquired: number | bigint | null;
};

@Injectable()
export class DemoMaintenanceService {
  private readonly logger = new Logger(DemoMaintenanceService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 4 * * *', {
    name: 'demo-data-reset',
    timeZone: 'Asia/Seoul'
  })
  async resetDemoDataAtKoreanDawn() {
    // 공개 데모 계정만 매일 초기화한다. 운영 테넌트 보호는 seed의 resetDemoUser 경계와 DB lock에 맡긴다.
    const env = getApiEnv();

    if (!env.DEMO_RESET_SCHEDULE_ENABLED) {
      this.logger.debug('Scheduled demo data reset is disabled.');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Previous demo data reset is still running. Skipping.');
      return;
    }

    this.isRunning = true;
    let lockAcquired = false;

    try {
      lockAcquired = await this.acquireResetLock();

      if (!lockAcquired) {
        this.logger.warn(
          'Another API instance is already resetting demo data. Skipping.'
        );
        return;
      }

      const summary = await seedDemoData({
        prismaClient: this.prisma,
        apiEnv: env,
        resetDemoUser: true,
        seedInitialAdmin: false,
        shouldPrintSummary: false
      });

      this.logger.log(
        [
          `Demo data reset completed for ${env.DEMO_EMAIL}.`,
          `user reset: ${summary.resetDemoUser ? 'yes' : 'no'}`,
          `accounts created/skipped: ${summary.accounts.created}/${summary.accounts.skipped}`,
          `imported rows created/skipped: ${summary.importedRows.created}/${summary.importedRows.skipped}`,
          `collected transactions created/skipped: ${summary.collectedTransactions.created}/${summary.collectedTransactions.skipped}`
        ].join(' ')
      );
    } catch (error) {
      this.logger.error(
        'Scheduled demo data reset failed.',
        error instanceof Error ? error.stack : String(error)
      );
    } finally {
      if (lockAcquired) {
        try {
          await this.releaseResetLock();
        } catch (error) {
          this.logger.warn(
            `Failed to release demo reset lock: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      this.isRunning = false;
    }
  }

  private async acquireResetLock() {
    const [result] = await this.prisma.$queryRaw<MySqlNamedLockResult[]>`
      SELECT GET_LOCK(${DEMO_RESET_LOCK_NAME}, 0) AS acquired
    `;

    return result?.acquired === 1 || result?.acquired === 1n;
  }

  private async releaseResetLock() {
    await this.prisma.$queryRaw`
      SELECT RELEASE_LOCK(${DEMO_RESET_LOCK_NAME})
    `;
  }
}
