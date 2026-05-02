import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ImportBatchCollectionJobRowStatus,
  ImportBatchCollectionJobStatus
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IMPORT_COLLECTION_STALE_JOB_MESSAGE } from './import-batch-collection-job.constants';

type ImportBatchCollectionJobMaintenanceScope = {
  tenantId?: string;
  ledgerId?: string;
  importBatchId?: string;
};

type ReconcileExpiredCollectionJobsResult = {
  finalizedJobCount: number;
  deletedLockCount: number;
};

const ACTIVE_JOB_STATUSES: ImportBatchCollectionJobStatus[] = [
  ImportBatchCollectionJobStatus.PENDING,
  ImportBatchCollectionJobStatus.RUNNING
];

const UNFINISHED_ROW_STATUSES: ImportBatchCollectionJobRowStatus[] = [
  ImportBatchCollectionJobRowStatus.PENDING,
  ImportBatchCollectionJobRowStatus.RUNNING
];

@Injectable()
export class ImportBatchCollectionJobMaintenanceService {
  private readonly logger = new Logger(
    ImportBatchCollectionJobMaintenanceService.name
  );

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileExpiredCollectionJobsOnSchedule(): Promise<void> {
    const result = await this.reconcileExpiredCollectionJobs();

    if (result.finalizedJobCount > 0 || result.deletedLockCount > 0) {
      this.logger.warn(
        `Reconciled ${result.finalizedJobCount} stale import batch collection jobs and ${result.deletedLockCount} expired locks.`
      );
    }
  }

  async reconcileExpiredCollectionJobs(
    now = new Date(),
    scope: ImportBatchCollectionJobMaintenanceScope = {}
  ): Promise<ReconcileExpiredCollectionJobsResult> {
    const expiredLocks = await this.prisma.importBatchCollectionLock.findMany({
      where: {
        ...scope,
        expiresAt: {
          lt: now
        }
      },
      select: {
        jobId: true
      }
    });
    const expiredJobIds = [
      ...new Set(expiredLocks.map((lock) => lock.jobId).filter(Boolean))
    ];

    if (expiredJobIds.length === 0) {
      return {
        finalizedJobCount: 0,
        deletedLockCount: 0
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const staleJobs = await tx.importBatchCollectionJob.findMany({
        where: {
          id: {
            in: expiredJobIds
          },
          status: {
            in: ACTIVE_JOB_STATUSES
          }
        },
        include: {
          rows: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      let finalizedJobCount = 0;
      for (const job of staleJobs) {
        const resolvedRows = job.rows.map((row) =>
          UNFINISHED_ROW_STATUSES.includes(row.status)
            ? { ...row, status: ImportBatchCollectionJobRowStatus.FAILED }
            : row
        );
        const unfinishedRowIds = job.rows
          .filter((row) => UNFINISHED_ROW_STATUSES.includes(row.status))
          .map((row) => row.id);

        if (unfinishedRowIds.length > 0) {
          await tx.importBatchCollectionJobRow.updateMany({
            where: {
              id: {
                in: unfinishedRowIds
              }
            },
            data: {
              status: ImportBatchCollectionJobRowStatus.FAILED,
              message: IMPORT_COLLECTION_STALE_JOB_MESSAGE,
              finishedAt: now
            }
          });
        }

        const succeededCount = resolvedRows.filter(
          (row) => row.status === ImportBatchCollectionJobRowStatus.COLLECTED
        ).length;
        const failedCount = resolvedRows.filter(
          (row) => row.status === ImportBatchCollectionJobRowStatus.FAILED
        ).length;
        const finalStatus = resolveStaleCollectionJobStatus({
          succeededCount,
          failedCount
        });
        const updated = await tx.importBatchCollectionJob.updateMany({
          where: {
            id: job.id,
            status: {
              in: ACTIVE_JOB_STATUSES
            }
          },
          data: {
            status: finalStatus,
            processedRowCount: resolvedRows.length,
            succeededCount,
            failedCount,
            errorMessage:
              finalStatus === ImportBatchCollectionJobStatus.SUCCEEDED
                ? null
                : IMPORT_COLLECTION_STALE_JOB_MESSAGE,
            finishedAt: now,
            heartbeatAt: now
          }
        });
        finalizedJobCount += updated.count;
      }

      const deletedLocks = await tx.importBatchCollectionLock.deleteMany({
        where: {
          ...scope,
          expiresAt: {
            lt: now
          }
        }
      });

      return {
        finalizedJobCount,
        deletedLockCount: deletedLocks.count
      };
    });
  }
}

function resolveStaleCollectionJobStatus(input: {
  succeededCount: number;
  failedCount: number;
}): ImportBatchCollectionJobStatus {
  if (input.succeededCount > 0 && input.failedCount > 0) {
    return ImportBatchCollectionJobStatus.PARTIAL;
  }

  if (input.failedCount > 0) {
    return ImportBatchCollectionJobStatus.FAILED;
  }

  return ImportBatchCollectionJobStatus.SUCCEEDED;
}
