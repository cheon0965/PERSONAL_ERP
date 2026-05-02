// eslint-disable-next-line no-restricted-imports
import { ConflictException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CancelImportBatchCollectionResponse
} from '@personal-erp/contracts';
// eslint-disable-next-line no-restricted-imports
import {
  CollectedTransactionStatus,
  ImportBatchCollectionJobStatus,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ImportBatchCollectionJobMaintenanceService } from '../../import-batch-collection-job-maintenance.service';

const CANCELLABLE_COLLECTED_TRANSACTION_STATUSES = [
  CollectedTransactionStatus.COLLECTED,
  CollectedTransactionStatus.REVIEWED,
  CollectedTransactionStatus.READY_TO_POST
] as const;

@Injectable()
export class CancelImportBatchCollectionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobMaintenance: ImportBatchCollectionJobMaintenanceService
  ) {}

  async execute(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<CancelImportBatchCollectionResponse | null> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'import_batch.cancel'
    );

    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true
      }
    });

    if (!batch) {
      return null;
    }
    await this.jobMaintenance.reconcileExpiredCollectionJobs(new Date(), {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      importBatchId
    });

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
        '일괄 등록 작업이 진행 중인 업로드 배치는 취소할 수 없습니다.'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const linkedTransactions = await tx.collectedTransaction.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          importBatchId
        },
        select: {
          id: true,
          status: true,
          matchedPlanItemId: true,
          postedJournalEntry: {
            select: {
              id: true
            }
          }
        }
      });

      const blockingTransaction = linkedTransactions.find(
        (transaction) =>
          !CANCELLABLE_COLLECTED_TRANSACTION_STATUSES.includes(
            transaction.status as (typeof CANCELLABLE_COLLECTED_TRANSACTION_STATUSES)[number]
          ) || transaction.postedJournalEntry != null
      );

      if (blockingTransaction) {
        throw new ConflictException(
          '이미 전표 확정 또는 정정 흐름에 들어간 수집 거래가 있어 업로드 배치 등록을 전체 취소할 수 없습니다. 전표 화면에서 반전 또는 정정으로 처리해 주세요.'
        );
      }

      const transactionIds = linkedTransactions.map(
        (transaction) => transaction.id
      );
      const matchedPlanItemIds = [
        ...new Set(
          linkedTransactions
            .map((transaction) => transaction.matchedPlanItemId)
            .filter((planItemId): planItemId is string => Boolean(planItemId))
        )
      ];

      let restoredPlanItemCount = 0;
      let restoredLiabilityRepaymentScheduleCount = 0;
      if (matchedPlanItemIds.length > 0) {
        const restored = await tx.planItem.updateMany({
          where: {
            id: {
              in: matchedPlanItemIds
            },
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          data: {
            status: PlanItemStatus.DRAFT
          }
        });
        restoredPlanItemCount = restored.count;

        const restoredRepayments =
          await tx.liabilityRepaymentSchedule.updateMany({
            where: {
              linkedPlanItemId: {
                in: matchedPlanItemIds
              },
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              status: LiabilityRepaymentScheduleStatus.MATCHED
            },
            data: {
              status: LiabilityRepaymentScheduleStatus.PLANNED
            }
          });
        restoredLiabilityRepaymentScheduleCount = restoredRepayments.count;
      }

      let cancelledTransactionCount = 0;
      if (transactionIds.length > 0) {
        const deleted = await tx.collectedTransaction.deleteMany({
          where: {
            id: {
              in: transactionIds
            },
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            importBatchId,
            status: {
              in: [...CANCELLABLE_COLLECTED_TRANSACTION_STATUSES]
            }
          }
        });
        cancelledTransactionCount = deleted.count;

        if (deleted.count !== transactionIds.length) {
          throw new ConflictException(
            '업로드 배치 연결 수집 거래가 취소 중 변경되었습니다. 새로고침 후 다시 시도해 주세요.'
          );
        }
      }

      return {
        importBatchId,
        cancelledTransactionCount,
        restoredPlanItemCount,
        restoredLiabilityRepaymentScheduleCount
      };
    });
  }
}
