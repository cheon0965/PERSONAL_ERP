import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CarryForwardView
} from '@personal-erp/contracts';
import { Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/public';
import { mapClosingSnapshotRecordToItem } from '../accounting-periods/public';
import { mapCarryForwardRecordToItem } from './carry-forward.mapper';
import { mapOpeningBalanceSnapshotRecordToItem } from './opening-balance-snapshot.mapper';

const carryForwardPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
    openingBalanceSnapshot: {
      select: {
        sourceKind: true
      }
    },
    statusHistory: {
      orderBy: {
        changedAt: 'desc'
      },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        eventType: true,
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

type CarryForwardPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof carryForwardPeriodInclude;
}>;

@Injectable()
export class CarryForwardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    fromPeriodId?: string
  ): Promise<CarryForwardView | null> {
    if (!fromPeriodId) {
      return null;
    }

    const workspace = requireCurrentWorkspace(user);
    return this.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      fromPeriodId
    );
  }

  async findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string
  ): Promise<CarryForwardView | null> {
    return this.buildView(tenantId, ledgerId, fromPeriodId);
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<CarryForwardPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      include: carryForwardPeriodInclude
    });
  }

  async findPeriodByYearMonthInWorkspace(
    tenantId: string,
    ledgerId: string,
    year: number,
    month: number
  ): Promise<CarryForwardPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        year,
        month
      },
      include: carryForwardPeriodInclude
    });
  }

  private async buildView(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string
  ): Promise<CarryForwardView | null> {
    const carryForwardRecord = await this.prisma.carryForwardRecord.findFirst({
      where: {
        tenantId,
        ledgerId,
        fromPeriodId
      }
    });

    if (!carryForwardRecord) {
      return null;
    }

    const [
      sourcePeriod,
      targetPeriod,
      sourceClosingSnapshot,
      targetOpeningSnapshot
    ] = await Promise.all([
      this.findPeriodByIdInWorkspace(
        tenantId,
        ledgerId,
        carryForwardRecord.fromPeriodId
      ),
      this.findPeriodByIdInWorkspace(
        tenantId,
        ledgerId,
        carryForwardRecord.toPeriodId
      ),
      this.prisma.closingSnapshot.findUnique({
        where: {
          periodId: carryForwardRecord.fromPeriodId
        },
        include: {
          lines: {
            include: {
              accountSubject: {
                select: {
                  code: true,
                  name: true
                }
              },
              fundingAccount: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      this.prisma.openingBalanceSnapshot.findUnique({
        where: {
          effectivePeriodId: carryForwardRecord.toPeriodId
        },
        include: {
          lines: {
            include: {
              accountSubject: {
                select: {
                  code: true,
                  name: true
                }
              },
              fundingAccount: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    if (
      !sourcePeriod ||
      !targetPeriod ||
      !sourceClosingSnapshot ||
      !targetOpeningSnapshot
    ) {
      return null;
    }

    return {
      carryForwardRecord: mapCarryForwardRecordToItem(carryForwardRecord),
      sourcePeriod: mapAccountingPeriodRecordToItem(sourcePeriod),
      sourceClosingSnapshot: mapClosingSnapshotRecordToItem({
        ...sourceClosingSnapshot,
        lines: sourceClosingSnapshot.lines.map((line) => ({
          id: line.id,
          accountSubjectCode: line.accountSubject.code,
          accountSubjectName: line.accountSubject.name,
          fundingAccountName: line.fundingAccount?.name ?? null,
          balanceAmount: line.balanceAmount
        }))
      }),
      targetPeriod: mapAccountingPeriodRecordToItem(targetPeriod),
      targetOpeningBalanceSnapshot: mapOpeningBalanceSnapshotRecordToItem({
        ...targetOpeningSnapshot,
        lines: targetOpeningSnapshot.lines.map((line) => ({
          id: line.id,
          accountSubjectCode: line.accountSubject.code,
          accountSubjectName: line.accountSubject.name,
          fundingAccountName: line.fundingAccount?.name ?? null,
          balanceAmount: line.balanceAmount
        }))
      })
    };
  }
}
