import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CancelCarryForwardRequest,
  CancelCarryForwardResponse
} from '@personal-erp/contracts';
import type { CarryForwardRecord, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/public';
import {
  assertCarryForwardCanBeCanceled,
  readNextMonth
} from './carry-forward.policy';
import { CarryForwardsService } from './carry-forwards.service';
import { mapCarryForwardRecordToItem } from './carry-forward.mapper';

@Injectable()
export class CancelCarryForwardUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carryForwardsService: CarryForwardsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    carryForwardRecordId: string,
    input: CancelCarryForwardRequest
  ): Promise<CancelCarryForwardResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertCancelPermission(workspace.membershipRole);

    return this.cancelInWorkspace({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      carryForwardRecordId,
      reason: input.reason
    });
  }

  async cancelExistingByFromPeriod(
    user: AuthenticatedUser,
    fromPeriodId: string,
    reason?: string
  ): Promise<CancelCarryForwardResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertCancelPermission(workspace.membershipRole);

    return this.cancelInWorkspace({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      fromPeriodId,
      reason
    });
  }

  private async cancelInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    carryForwardRecordId?: string;
    fromPeriodId?: string;
    reason?: string;
  }): Promise<CancelCarryForwardResponse> {
    const cancellationResult: {
      record?: CarryForwardRecord;
      openingBalanceSnapshotId?: string;
    } = {};

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.carryForwardRecord.findFirst({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          ...(input.carryForwardRecordId
            ? { id: input.carryForwardRecordId }
            : {}),
          ...(input.fromPeriodId ? { fromPeriodId: input.fromPeriodId } : {})
        }
      });

      if (!record) {
        throw new NotFoundException(
          '취소할 차기 이월 기록을 찾을 수 없습니다.'
        );
      }

      const [targetPeriod, targetOpeningBalanceSnapshot] = await Promise.all([
        tx.accountingPeriod.findFirst({
          where: {
            id: record.toPeriodId,
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          select: {
            id: true,
            status: true
          }
        }),
        tx.openingBalanceSnapshot.findUnique({
          where: {
            effectivePeriodId: record.toPeriodId
          }
        })
      ]);

      if (!targetPeriod || !targetOpeningBalanceSnapshot) {
        throw new NotFoundException(
          '차기 이월 취소에 필요한 다음 운영 기간 기준을 찾을 수 없습니다.'
        );
      }

      const targetUsageCounts = await readTargetUsageCounts(tx, {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        targetPeriodId: record.toPeriodId
      });

      assertCarryForwardCanBeCanceled({
        targetPeriodStatus: targetPeriod.status,
        targetOpeningBalanceSourceKind: targetOpeningBalanceSnapshot.sourceKind,
        createdJournalEntryId: record.createdJournalEntryId,
        targetUsageCounts
      });

      await tx.balanceSnapshotLine.deleteMany({
        where: {
          openingSnapshotId: targetOpeningBalanceSnapshot.id
        }
      });

      await tx.openingBalanceSnapshot.deleteMany({
        where: {
          id: targetOpeningBalanceSnapshot.id,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          effectivePeriodId: record.toPeriodId
        }
      });

      await tx.carryForwardRecord.deleteMany({
        where: {
          id: record.id,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        }
      });

      cancellationResult.record = record;
      cancellationResult.openingBalanceSnapshotId =
        targetOpeningBalanceSnapshot.id;
    });

    if (
      !cancellationResult.record ||
      !cancellationResult.openingBalanceSnapshotId
    ) {
      throw new NotFoundException(
        '취소한 차기 이월 기록을 확인할 수 없습니다.'
      );
    }

    const canceledRecord = cancellationResult.record;
    const [sourcePeriod, targetPeriod] = await Promise.all([
      this.carryForwardsService.findPeriodByIdInWorkspace(
        input.tenantId,
        input.ledgerId,
        canceledRecord.fromPeriodId
      ),
      this.carryForwardsService.findPeriodByIdInWorkspace(
        input.tenantId,
        input.ledgerId,
        canceledRecord.toPeriodId
      )
    ]);

    if (!sourcePeriod || !targetPeriod) {
      throw new NotFoundException(
        '취소 이후 운영 기간 정보를 다시 불러오지 못했습니다.'
      );
    }

    return {
      carryForwardRecord: mapCarryForwardRecordToItem(canceledRecord),
      sourcePeriod: mapAccountingPeriodRecordToItem(sourcePeriod),
      targetPeriod: mapAccountingPeriodRecordToItem(targetPeriod),
      canceledOpeningBalanceSnapshotId:
        cancellationResult.openingBalanceSnapshotId
    };
  }
}

async function readTargetUsageCounts(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    ledgerId: string;
    targetPeriodId: string;
  }
) {
  const [
    collectedTransactions,
    importBatches,
    journalEntries,
    financialStatementSnapshots,
    closingSnapshot
  ] = await Promise.all([
    tx.collectedTransaction.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.targetPeriodId
      }
    }),
    tx.importBatch.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.targetPeriodId
      }
    }),
    tx.journalEntry.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.targetPeriodId
      }
    }),
    tx.financialStatementSnapshot.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.targetPeriodId
      }
    }),
    tx.closingSnapshot.findUnique({
      where: {
        periodId: input.targetPeriodId
      },
      select: {
        id: true
      }
    })
  ]);

  return {
    collectedTransactions,
    importBatches,
    journalEntries,
    financialStatementSnapshots,
    closingSnapshots: closingSnapshot ? 1 : 0
  };
}

function assertCancelPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'carry_forward.cancel');
}

export function buildCarryForwardReplaceReason(year: number, month: number) {
  const { monthLabel } = readNextMonth(year, month);
  return `${monthLabel} 오프닝 기준 재생성을 위한 기존 차기 이월 취소`;
}
