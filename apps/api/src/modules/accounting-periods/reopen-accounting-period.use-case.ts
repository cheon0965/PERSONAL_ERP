import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  type Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { OperationalAuditPublisher } from '../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../common/infrastructure/operational/period-status-history-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodReaderPort } from './application/ports/accounting-period-reader.port';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { normalizeOptionalText } from './accounting-period.policy';
import {
  assertAccountingPeriodCanBeReopened,
  assertAccountingPeriodCanBeReopenedWithoutDependents
} from './accounting-period-transition.policy';

@Injectable()
export class ReopenAccountingPeriodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodReader: AccountingPeriodReaderPort,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  async execute(
    user: AuthenticatedUser,
    periodId: string,
    input: ReopenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    assertReopenPermission(workspace.membershipRole);

    const period = await this.accountingPeriodReader.findByIdInWorkspace(
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      periodId
    );

    if (!period) {
      throw new NotFoundException('재오픈할 운영 기간을 찾을 수 없습니다.');
    }

    assertAccountingPeriodCanBeReopened(period.status);

    // 차기 이월이나 다음 월 오프닝 스냅샷이 이미 이어져 있으면 재오픈이 다음 달 기준을
    // 깨뜨릴 수 있다. 먼저 후속 산출물이 없는지 확인해 월별 연결성을 보호한다.
    const { nextYear, nextMonth } = readNextAccountingPeriodBoundary(
      period.year,
      period.month
    );
    const [existingCarryForwardRecord, nextPeriod] = await Promise.all([
      this.prisma.carryForwardRecord.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          fromPeriodId: period.id
        },
        select: {
          id: true,
          toPeriodId: true
        }
      }),
      this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          year: nextYear,
          month: nextMonth
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          openingBalanceSnapshot: {
            select: {
              sourceKind: true
            }
          }
        }
      })
    ]);

    assertAccountingPeriodCanBeReopenedWithoutDependents({
      carryForwardRecordId: existingCarryForwardRecord?.id ?? null,
      nextOpeningBalanceSourceKind:
        nextPeriod?.openingBalanceSnapshot?.sourceKind ?? null
    });

    const latestPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        year: true,
        month: true
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    // 과거 잠금월을 임의로 재오픈하면 최신 진행월 정책이 깨진다.
    // 다만 바로 다음 최신 OPEN 월이 아직 완전히 비어 있으면 사용자가 실수로
    // 먼저 열어 둔 월을 함께 되돌리고 대상 마감월을 다시 열 수 있다.
    let latestSuccessorRollback: LatestSuccessorPeriodRollback | null = null;
    if (latestPeriod && latestPeriod.id !== period.id) {
      latestSuccessorRollback =
        await readLatestSuccessorPeriodRollbackCandidate(this.prisma, {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          sourcePeriod: period,
          latestPeriod,
          nextPeriod
        });

      if (!latestSuccessorRollback) {
        throw new ConflictException(
          `최근 운영 월 ${formatYearMonth(latestPeriod.year, latestPeriod.month)}이 이미 존재해 ${formatYearMonth(period.year, period.month)}은 재오픈할 수 없습니다. 운영 중에는 하나의 최신 진행월만 열어 둡니다.`
        );
      }
    }

    const reason = normalizeOptionalText(input.reason);
    if (!reason) {
      throw new BadRequestException('재오픈 사유를 입력해 주세요.');
    }

    const createdStatusHistory = await this.prisma.$transaction(async (tx) => {
      if (latestSuccessorRollback) {
        await rollbackLatestSuccessorPeriod(tx, {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          sourceMonthLabel: formatYearMonth(period.year, period.month),
          rollback: latestSuccessorRollback
        });
      }

      // 재오픈은 "마감 이전 상태로 되돌리는" 작업이다. 공식 보고 산출물과
      // 마감 스냅샷을 먼저 제거한 뒤 기간 상태를 OPEN으로 돌린다.
      await tx.financialStatementSnapshot.deleteMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id
        }
      });

      await tx.closingSnapshot.deleteMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id
        }
      });

      await tx.accountingPeriod.update({
        where: {
          id: period.id
        },
        data: {
          status: AccountingPeriodStatus.OPEN,
          lockedAt: null
        }
      });

      return tx.periodStatusHistory.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          fromStatus: period.status,
          toStatus: AccountingPeriodStatus.OPEN,
          eventType: AccountingPeriodEventType.REOPEN,
          reason,
          ...actorRef
        }
      });
    });

    publishPeriodStatusHistoryAudit(this.auditPublisher, createdStatusHistory);

    const refreshedPeriod =
      await this.accountingPeriodReader.findByIdInWorkspace(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        period.id
      );

    if (!refreshedPeriod) {
      throw new NotFoundException(
        '재오픈 이후 운영 기간을 다시 불러오지 못했습니다.'
      );
    }

    return mapAccountingPeriodRecordToItem(refreshedPeriod);
  }
}

function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function assertReopenPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(
    membershipRole,
    'accounting_period.reopen'
  );
}

function readNextAccountingPeriodBoundary(
  year: number,
  month: number
): {
  nextYear: number;
  nextMonth: number;
} {
  if (month === 12) {
    return {
      nextYear: year + 1,
      nextMonth: 1
    };
  }

  return {
    nextYear: year,
    nextMonth: month + 1
  };
}

type LatestSuccessorPeriodRollback = {
  periodId: string;
  monthLabel: string;
  usageCounts: PeriodRollbackUsageCounts;
};

type PeriodRollbackUsageCounts = {
  planItems: number;
  importBatches: number;
  collectedTransactions: number;
  journalEntries: number;
  financialStatementSnapshots: number;
  closingSnapshots: number;
  operationalNotes: number;
};

type PeriodRollbackPrismaClient = Pick<
  Prisma.TransactionClient,
  | 'accountingPeriod'
  | 'carryForwardRecord'
  | 'closingSnapshot'
  | 'collectedTransaction'
  | 'financialStatementSnapshot'
  | 'importBatch'
  | 'journalEntry'
  | 'openingBalanceSnapshot'
  | 'periodStatusHistory'
  | 'planItem'
  | 'workspaceOperationalNote'
>;

async function readLatestSuccessorPeriodRollbackCandidate(
  client: PeriodRollbackPrismaClient,
  input: {
    tenantId: string;
    ledgerId: string;
    sourcePeriod: Pick<AccountingPeriodItem, 'year' | 'month'>;
    latestPeriod: {
      id: string;
      year: number;
      month: number;
    };
    nextPeriod: {
      id: string;
      year: number;
      month: number;
      status: AccountingPeriodStatus;
      openingBalanceSnapshot: {
        sourceKind: string;
      } | null;
    } | null;
  }
): Promise<LatestSuccessorPeriodRollback | null> {
  if (!input.nextPeriod || input.latestPeriod.id !== input.nextPeriod.id) {
    return null;
  }

  if (
    input.nextPeriod.status !== AccountingPeriodStatus.OPEN ||
    input.nextPeriod.openingBalanceSnapshot
  ) {
    return null;
  }

  const targetMonthLabel = formatYearMonth(
    input.nextPeriod.year,
    input.nextPeriod.month
  );
  const usageCounts = await readPeriodRollbackUsageCounts(client, {
    tenantId: input.tenantId,
    ledgerId: input.ledgerId,
    periodId: input.nextPeriod.id
  });

  assertLatestSuccessorPeriodHasNoUsage({
    sourceMonthLabel: formatYearMonth(
      input.sourcePeriod.year,
      input.sourcePeriod.month
    ),
    targetMonthLabel,
    usageCounts
  });

  return {
    periodId: input.nextPeriod.id,
    monthLabel: targetMonthLabel,
    usageCounts
  };
}

async function rollbackLatestSuccessorPeriod(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    ledgerId: string;
    sourceMonthLabel: string;
    rollback: LatestSuccessorPeriodRollback;
  }
) {
  const [successorPeriod, openingBalanceSnapshot, carryForwardRecord] =
    await Promise.all([
      tx.accountingPeriod.findFirst({
        where: {
          id: input.rollback.periodId,
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
          effectivePeriodId: input.rollback.periodId
        },
        select: {
          id: true,
          sourceKind: true
        }
      }),
      tx.carryForwardRecord.findFirst({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          toPeriodId: input.rollback.periodId
        }
      })
    ]);

  if (
    !successorPeriod ||
    successorPeriod.status !== AccountingPeriodStatus.OPEN ||
    openingBalanceSnapshot ||
    carryForwardRecord
  ) {
    throw new ConflictException(
      '최신 운영 월 상태가 바뀌어 재오픈할 수 없습니다. 운영 기간 목록을 새로고침한 뒤 다시 확인해 주세요.'
    );
  }

  const usageCounts = await readPeriodRollbackUsageCounts(tx, {
    tenantId: input.tenantId,
    ledgerId: input.ledgerId,
    periodId: input.rollback.periodId
  });

  assertLatestSuccessorPeriodHasNoUsage({
    sourceMonthLabel: input.sourceMonthLabel,
    targetMonthLabel: input.rollback.monthLabel,
    usageCounts
  });

  await tx.periodStatusHistory.deleteMany({
    where: {
      tenantId: input.tenantId,
      ledgerId: input.ledgerId,
      periodId: input.rollback.periodId
    }
  });

  const deletedPeriod = await tx.accountingPeriod.deleteMany({
    where: {
      id: input.rollback.periodId,
      tenantId: input.tenantId,
      ledgerId: input.ledgerId,
      status: AccountingPeriodStatus.OPEN
    }
  });

  if (deletedPeriod.count !== 1) {
    throw new ConflictException(
      '최신 운영 월 상태가 바뀌어 재오픈할 수 없습니다. 운영 기간 목록을 새로고침한 뒤 다시 확인해 주세요.'
    );
  }
}

async function readPeriodRollbackUsageCounts(
  client: PeriodRollbackPrismaClient,
  input: {
    tenantId: string;
    ledgerId: string;
    periodId: string;
  }
): Promise<PeriodRollbackUsageCounts> {
  const [
    planItems,
    importBatches,
    collectedTransactions,
    journalEntries,
    financialStatementSnapshots,
    closingSnapshot,
    operationalNotes
  ] = await Promise.all([
    client.planItem.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    }),
    client.importBatch.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    }),
    client.collectedTransaction.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    }),
    client.journalEntry.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    }),
    client.financialStatementSnapshot.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    }),
    client.closingSnapshot.findUnique({
      where: {
        periodId: input.periodId
      },
      select: {
        id: true
      }
    }),
    client.workspaceOperationalNote.count({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId
      }
    })
  ]);

  return {
    planItems,
    importBatches,
    collectedTransactions,
    journalEntries,
    financialStatementSnapshots,
    closingSnapshots: closingSnapshot ? 1 : 0,
    operationalNotes
  };
}

function assertLatestSuccessorPeriodHasNoUsage(input: {
  sourceMonthLabel: string;
  targetMonthLabel: string;
  usageCounts: PeriodRollbackUsageCounts;
}) {
  const usageLabels = readPeriodRollbackUsageLabels(input.usageCounts);

  if (usageLabels.length === 0) {
    return;
  }

  throw new ConflictException(
    `최근 운영 월 ${input.targetMonthLabel}에 ${usageLabels.join(', ')}이 있어 ${input.sourceMonthLabel}은 재오픈할 수 없습니다. 최신 월 데이터를 먼저 정리한 뒤 다시 시도해 주세요.`
  );
}

function readPeriodRollbackUsageLabels(usageCounts: PeriodRollbackUsageCounts) {
  const labels: string[] = [];

  if (usageCounts.planItems > 0) {
    labels.push(`계획 ${usageCounts.planItems}건`);
  }

  if (usageCounts.importBatches > 0) {
    labels.push(`업로드 ${usageCounts.importBatches}건`);
  }

  if (usageCounts.collectedTransactions > 0) {
    labels.push(`수집 거래 ${usageCounts.collectedTransactions}건`);
  }

  if (usageCounts.journalEntries > 0) {
    labels.push(`전표 ${usageCounts.journalEntries}건`);
  }

  if (usageCounts.financialStatementSnapshots > 0) {
    labels.push(`재무제표 ${usageCounts.financialStatementSnapshots}건`);
  }

  if (usageCounts.closingSnapshots > 0) {
    labels.push(`마감 스냅샷 ${usageCounts.closingSnapshots}건`);
  }

  if (usageCounts.operationalNotes > 0) {
    labels.push(`운영 메모 ${usageCounts.operationalNotes}건`);
  }

  return labels;
}
