// eslint-disable-next-line no-restricted-imports
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchCollectionJobItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import {
  importBatchCollectionJobSelect,
  mapImportBatchCollectionJobToItem
} from '../../import-batch-collection-job.mapper';

@Injectable()
export class GetImportBatchCollectionJobUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string,
    jobId: string
  ): Promise<ImportBatchCollectionJobItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
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

    return mapImportBatchCollectionJobToItem(job);
  }
}
