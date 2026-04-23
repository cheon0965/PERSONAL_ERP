// eslint-disable-next-line no-restricted-imports
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchCollectionJobItem
} from '@personal-erp/contracts';
// eslint-disable-next-line no-restricted-imports
import { ImportBatchCollectionJobStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  importBatchCollectionJobSelect,
  mapImportBatchCollectionJobToItem
} from '../../import-batch-collection-job.mapper';

const collectionJobCancelMessage =
  '사용자가 업로드 배치 일괄 등록 작업을 중단했습니다.';

@Injectable()
export class CancelImportBatchCollectionJobUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ): Promise<ImportBatchCollectionJobItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'import_batch.cancel'
    );

    const job = await this.prisma.importBatchCollectionJob.findFirst({
      where: {
        id: jobId,
        importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: importBatchCollectionJobSelect
    });

    if (!job) {
      throw new NotFoundException(
        '업로드 배치 일괄 등록 작업을 찾을 수 없습니다.'
      );
    }

    if (!isCancellableCollectionJobStatus(job.status)) {
      return mapImportBatchCollectionJobToItem(job);
    }

    const now = new Date();
    await this.prisma.importBatchCollectionJob.update({
      where: {
        id: job.id
      },
      data: {
        status: ImportBatchCollectionJobStatus.CANCELLED,
        errorMessage: collectionJobCancelMessage,
        heartbeatAt: now,
        ...(job.status === ImportBatchCollectionJobStatus.PENDING
          ? { finishedAt: now }
          : {})
      }
    });

    if (job.status === ImportBatchCollectionJobStatus.PENDING) {
      await this.prisma.importBatchCollectionLock.deleteMany({
        where: {
          jobId: job.id
        }
      });
    }

    const cancelledJob = await this.prisma.importBatchCollectionJob.findFirst({
      where: {
        id: job.id,
        importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: importBatchCollectionJobSelect
    });

    if (!cancelledJob) {
      throw new NotFoundException(
        '업로드 배치 일괄 등록 작업을 찾을 수 없습니다.'
      );
    }

    return mapImportBatchCollectionJobToItem(cancelledJob);
  }
}

function isCancellableCollectionJobStatus(
  status: ImportBatchCollectionJobStatus
) {
  return (
    status === ImportBatchCollectionJobStatus.PENDING ||
    status === ImportBatchCollectionJobStatus.RUNNING
  );
}
