import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  FinancialStatementsView
} from '@personal-erp/contracts';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import { mapFinancialStatementSnapshotRecordToItem } from './financial-statement-snapshot.mapper';
import { sortFinancialStatementSnapshots } from './financial-statement-payload.policy';

const financialStatementPeriodInclude =
  Prisma.validator<Prisma.AccountingPeriodInclude>()({
    ledger: {
      select: {
        baseCurrency: true
      }
    },
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
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

type FinancialStatementPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof financialStatementPeriodInclude;
}>;

const financialStatementSnapshotInclude =
  Prisma.validator<Prisma.FinancialStatementSnapshotInclude>()({
    period: {
      select: {
        year: true,
        month: true
      }
    }
  });

@Injectable()
export class FinancialStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<FinancialStatementsView | null> {
    const workspace = requireCurrentWorkspace(user);

    return this.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      periodId
    );
  }

  async findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<FinancialStatementsView | null> {
    const period = await this.findTargetPeriodInWorkspace(
      tenantId,
      ledgerId,
      periodId
    );
    if (!period) {
      return null;
    }

    return this.buildView(period);
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<FinancialStatementPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      include: financialStatementPeriodInclude
    });
  }

  async findSnapshotsInPeriod(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ) {
    const snapshots = await this.prisma.financialStatementSnapshot.findMany({
      where: {
        tenantId,
        ledgerId,
        periodId
      },
      include: financialStatementSnapshotInclude
    });

    return sortFinancialStatementSnapshots(
      snapshots.map(mapFinancialStatementSnapshotRecordToItem)
    );
  }

  private async buildView(
    period: FinancialStatementPeriodRecord
  ): Promise<FinancialStatementsView> {
    const snapshots = await this.findSnapshotsInPeriod(
      period.tenantId,
      period.ledgerId,
      period.id
    );

    return {
      period: mapAccountingPeriodRecordToItem(period),
      snapshots
    };
  }

  private async findTargetPeriodInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ): Promise<FinancialStatementPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        ...(periodId
          ? { id: periodId }
          : {
              status: AccountingPeriodStatus.LOCKED
            })
      },
      include: financialStatementPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }
}
