import { Injectable } from '@nestjs/common';
import {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  BalanceSnapshotKind,
  OpeningBalanceSourceKind
} from '@prisma/client';
import type { PrismaMoneyLike } from '../../../../common/money/prisma-money';
import { OperationalAuditPublisher } from '../../../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../../../common/infrastructure/operational/period-status-history-audit';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  CarryForwardGenerationContext,
  CarryForwardGenerationPort
} from '../../application/ports/carry-forward-generation.port';

@Injectable()
export class PrismaCarryForwardGenerationAdapter implements CarryForwardGenerationPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  async readGenerationContext(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string,
    nextYear: number,
    nextMonth: number
  ): Promise<CarryForwardGenerationContext> {
    const [
      sourcePeriod,
      sourceClosingSnapshot,
      existingRecord,
      existingTargetPeriod
    ] = await Promise.all([
      this.prisma.accountingPeriod.findFirst({
        where: {
          id: fromPeriodId,
          tenantId,
          ledgerId
        },
        select: {
          id: true,
          tenantId: true,
          ledgerId: true,
          year: true,
          month: true,
          status: true,
          openingBalanceSnapshot: {
            select: {
              id: true
            }
          }
        }
      }),
      this.prisma.closingSnapshot.findUnique({
        where: {
          periodId: fromPeriodId
        },
        include: {
          lines: {
            include: {
              accountSubject: {
                select: {
                  subjectKind: true
                }
              }
            }
          }
        }
      }),
      this.prisma.carryForwardRecord.findFirst({
        where: {
          tenantId,
          ledgerId,
          fromPeriodId
        },
        select: {
          id: true
        }
      }),
      this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId,
          ledgerId,
          year: nextYear,
          month: nextMonth
        },
        select: {
          id: true,
          tenantId: true,
          ledgerId: true,
          year: true,
          month: true,
          status: true,
          openingBalanceSnapshot: {
            select: {
              id: true
            }
          }
        }
      })
    ]);

    return {
      sourcePeriod,
      sourceClosingSnapshot,
      existingRecord,
      existingTargetPeriod
    };
  }

  async createCarryForward(
    input: Parameters<CarryForwardGenerationPort['createCarryForward']>[0]
  ): Promise<void> {
    const createdStatusHistory = await this.prisma.$transaction(async (tx) => {
      const targetPeriod =
        input.existingTargetPeriod ??
        (await tx.accountingPeriod.create({
          data: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId,
            year: input.nextYear,
            month: input.nextMonth,
            startDate: input.nextPeriodBoundary.startDate,
            endDate: input.nextPeriodBoundary.endDate,
            status: AccountingPeriodStatus.OPEN
          }
        }));

      const createdStatusHistory = !input.existingTargetPeriod
        ? await tx.periodStatusHistory.create({
            data: {
              tenantId: input.tenantId,
              ledgerId: input.ledgerId,
              periodId: targetPeriod.id,
              fromStatus: null,
              toStatus: AccountingPeriodStatus.OPEN,
              eventType: AccountingPeriodEventType.OPEN,
              reason: `${input.sourcePeriod.year}-${String(input.sourcePeriod.month).padStart(2, '0')} 이월 생성`,
              ...input.actorRef
            }
          })
        : null;

      const openingBalanceSnapshot = await tx.openingBalanceSnapshot.create({
        data: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          effectivePeriodId: targetPeriod.id,
          sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
          ...input.createdByActorRef
        }
      });

      if (input.carryableLines.length > 0) {
        await tx.balanceSnapshotLine.createMany({
          data: input.carryableLines.map((line) => ({
            snapshotKind: BalanceSnapshotKind.OPENING,
            openingSnapshotId: openingBalanceSnapshot.id,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId,
            balanceAmount: line.balanceAmount as PrismaMoneyLike
          }))
        });
      }

      await tx.carryForwardRecord.create({
        data: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          fromPeriodId: input.sourcePeriod.id,
          toPeriodId: targetPeriod.id,
          sourceClosingSnapshotId: input.sourceClosingSnapshotId,
          createdJournalEntryId: null,
          ...input.createdByActorRef
        }
      });

      return createdStatusHistory;
    });

    if (createdStatusHistory) {
      publishPeriodStatusHistoryAudit(
        this.auditPublisher,
        createdStatusHistory
      );
    }
  }
}
