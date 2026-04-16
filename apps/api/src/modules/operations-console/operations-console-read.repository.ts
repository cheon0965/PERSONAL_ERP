import { Injectable } from '@nestjs/common';
import type { OperationsSystemComponentItem } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import type {
  OperationsSnapshot,
  ReferenceReadinessGap
} from './operations-console-read.model';

export type OperationsConsoleWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

const openPeriodStatuses: readonly AccountingPeriodStatus[] = [
  AccountingPeriodStatus.OPEN,
  AccountingPeriodStatus.IN_REVIEW,
  AccountingPeriodStatus.CLOSING
] as const;

const unresolvedTransactionStatuses = [
  CollectedTransactionStatus.COLLECTED,
  CollectedTransactionStatus.REVIEWED,
  CollectedTransactionStatus.READY_TO_POST
] as const;

const operationsPeriodInclude =
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

@Injectable()
export class OperationsConsoleReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async readSnapshot(
    workspace: OperationsConsoleWorkspaceScope
  ): Promise<OperationsSnapshot> {
    const readinessGapsPromise = this.readReadinessGaps(workspace);
    const periodsPromise = this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: operationsPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
    const unresolvedTransactionsPromise =
      this.prisma.collectedTransaction.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [...unresolvedTransactionStatuses]
          }
        },
        select: {
          id: true,
          title: true,
          status: true,
          occurredOn: true
        },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
        take: 50
      });
    const importBatchesPromise = this.prisma.importBatch.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
        rows: {
          select: {
            parseStatus: true,
            createdCollectedTransaction: {
              select: {
                id: true
              }
            }
          },
          orderBy: {
            rowNumber: 'asc'
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });
    const failedAuditEventsPromise = this.prisma.workspaceAuditEvent.findMany({
      where: {
        tenantId: workspace.tenantId,
        result: 'FAILED'
      },
      take: 5
    });
    const successfulAuditEventsPromise =
      this.prisma.workspaceAuditEvent.findMany({
        where: {
          tenantId: workspace.tenantId,
          result: 'SUCCESS'
        },
        take: 5
      });
    const deniedAuditEventsPromise = this.prisma.workspaceAuditEvent.findMany({
      where: {
        tenantId: workspace.tenantId,
        result: 'DENIED'
      },
      take: 5
    });

    const [
      readinessGaps,
      periods,
      unresolvedTransactions,
      importBatches,
      failedAuditEvents,
      successfulAuditEvents,
      deniedAuditEvents
    ] = await Promise.all([
      readinessGapsPromise,
      periodsPromise,
      unresolvedTransactionsPromise,
      importBatchesPromise,
      failedAuditEventsPromise,
      successfulAuditEventsPromise,
      deniedAuditEventsPromise
    ]);

    const currentPeriodRecord =
      periods.find((period) => openPeriodStatuses.includes(period.status)) ??
      periods[0] ??
      null;
    const currentPeriod = currentPeriodRecord
      ? mapAccountingPeriodRecordToItem(currentPeriodRecord)
      : null;

    const [
      remainingPlanItems,
      financialStatementSnapshots,
      carryForwardRecord
    ] = currentPeriodRecord
      ? await Promise.all([
          this.prisma.planItem.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              periodId: currentPeriodRecord.id,
              status: PlanItemStatus.DRAFT
            },
            select: {
              id: true,
              plannedAmount: true
            }
          }),
          this.prisma.financialStatementSnapshot.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              periodId: currentPeriodRecord.id
            }
          }),
          this.prisma.carryForwardRecord.findFirst({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              fromPeriodId: currentPeriodRecord.id
            }
          })
        ])
      : [[], [], null];

    return {
      generatedAt: new Date().toISOString(),
      currentPeriod,
      readinessGaps,
      unresolvedTransactions,
      importBatches,
      remainingPlanItems,
      financialStatementSnapshotCount: financialStatementSnapshots.length,
      carryForwardCreated: Boolean(carryForwardRecord),
      failedAuditEvents,
      successfulAuditEvents,
      deniedAuditEvents
    };
  }

  async readDatabaseStatus(
    checkedAt: string
  ): Promise<OperationsSystemComponentItem> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        key: 'database',
        label: 'Database readiness',
        status: 'OPERATIONAL',
        detail: 'DB readiness 쿼리가 성공했습니다.',
        lastCheckedAt: checkedAt
      };
    } catch {
      return {
        key: 'database',
        label: 'Database readiness',
        status: 'DOWN',
        detail: 'DB readiness 쿼리가 실패했습니다.',
        lastCheckedAt: checkedAt
      };
    }
  }

  private async readReadinessGaps(
    workspace: OperationsConsoleWorkspaceScope
  ): Promise<ReferenceReadinessGap[]> {
    const [
      fundingAccounts,
      incomeCategories,
      expenseCategories,
      accountSubjects,
      ledgerTransactionTypes
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: 'ACTIVE'
        }
      }),
      this.prisma.category.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          kind: 'INCOME',
          isActive: true
        }
      }),
      this.prisma.category.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          kind: 'EXPENSE',
          isActive: true
        }
      }),
      this.prisma.accountSubject.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        }
      }),
      this.prisma.ledgerTransactionType.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        }
      })
    ]);

    return [
      {
        key: 'funding-accounts',
        label: '자금수단',
        href: '/reference-data/funding-accounts',
        ready: fundingAccounts.length > 0
      },
      {
        key: 'income-categories',
        label: '수입 카테고리',
        href: '/reference-data/categories',
        ready: incomeCategories.length > 0
      },
      {
        key: 'expense-categories',
        label: '지출 카테고리',
        href: '/reference-data/categories',
        ready: expenseCategories.length > 0
      },
      {
        key: 'account-subjects',
        label: '계정과목',
        href: '/reference-data/lookups',
        ready: accountSubjects.length > 0
      },
      {
        key: 'ledger-transaction-types',
        label: '거래유형',
        href: '/reference-data/lookups',
        ready: ledgerTransactionTypes.length > 0
      }
    ]
      .filter((item) => !item.ready)
      .map(({ key, label, href }) => ({ key, label, href }));
  }
}
