// eslint-disable-next-line no-restricted-imports
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class GetActiveImportBatchCollectionJobUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<ImportBatchCollectionJobItem | null> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const job = await this.prisma.importBatchCollectionJob.findFirst({
      where: {
        importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [
            ImportBatchCollectionJobStatus.PENDING,
            ImportBatchCollectionJobStatus.RUNNING
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: importBatchCollectionJobSelect
    });

    return job ? mapImportBatchCollectionJobToItem(job) : null;
  }
}
