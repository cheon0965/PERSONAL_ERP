// eslint-disable-next-line no-restricted-imports
import { ConflictException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@personal-erp/contracts';
// eslint-disable-next-line no-restricted-imports
import { ImportBatchCollectionJobStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';

@Injectable()
export class DeleteImportBatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'import_batch.delete'
    );

    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    if (!batch) {
      return false;
    }

    const linkedTransactions = await this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        importBatchId
      },
      select: {
        id: true
      },
      take: 1
    });

    if (linkedTransactions.length > 0) {
      throw new ConflictException(
        '이미 수집 거래와 연결된 업로드 배치는 삭제할 수 없습니다. 먼저 연결된 수집 거래를 정리해 주세요.'
      );
    }

    const activeCollectionJob =
      await this.prisma.importBatchCollectionJob.findFirst({
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
        select: {
          id: true
        }
      });

    if (activeCollectionJob) {
      throw new ConflictException(
        '일괄 등록 작업이 진행 중인 업로드 배치는 삭제할 수 없습니다.'
      );
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.importBatchCollectionLock.deleteMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          importBatchId
        }
      });
      await tx.importBatchCollectionJob.deleteMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          importBatchId
        }
      });

      return tx.importBatch.deleteMany({
        where: {
          id: importBatchId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      });
    });

    return deleted.count === 1;
  }
}
