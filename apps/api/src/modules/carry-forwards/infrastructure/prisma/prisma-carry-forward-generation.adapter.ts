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

/**
 * 이월 생성 포트를 Prisma 저장소 작업으로 구현합니다.
 *
 * 유스케이스는 "어떤 라인을 이월할지"만 결정하고, 이 어댑터는 대상 운영월 생성,
 * 오프닝 스냅샷 저장, 이월 기록 저장, 상태 이력 감사를 한 트랜잭션으로 묶습니다.
 */
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
    // 이월 가능성 판단에 필요한 네 가지 정보를 병렬로 읽어 유스케이스가 별도 조회 순서를 신경 쓰지 않게 한다.
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
      // 다음 월 기간이 없으면 OPEN 상태로 만들고, 이미 있으면 그 기간에 오프닝 스냅샷만 붙인다.
      // 잠김/오프닝 존재 여부는 유스케이스에서 먼저 보호한다.
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

      // 이월 라인이 0건이어도 snapshot과 carryForwardRecord는 생성한다.
      // 그래야 "이월을 검토했지만 넘길 잔액이 없음"이라는 운영 이력이 남는다.
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
