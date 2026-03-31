import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser
} from '@personal-erp/contracts';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { readCollectingAccountingPeriodStatuses } from './accounting-period-transition.policy';

const accountingPeriodInclude =
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
        reason: true,
        actorType: true,
        actorMembershipId: true,
        changedAt: true
      }
    }
  });

type AccountingPeriodRecord = Prisma.AccountingPeriodGetPayload<{
  include: typeof accountingPeriodInclude;
}>;

@Injectable()
export class AccountingPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser): Promise<AccountingPeriodItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const periods = await this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: accountingPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return periods.map(mapAccountingPeriodRecordToItem);
  }

  async findCurrent(
    user: AuthenticatedUser
  ): Promise<AccountingPeriodItem | null> {
    const currentPeriod = await this.findCurrentPeriodRecord(user);

    return currentPeriod
      ? mapAccountingPeriodRecordToItem(currentPeriod)
      : null;
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<AccountingPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      include: accountingPeriodInclude
    });
  }

  async assertCollectingDateAllowed(
    user: AuthenticatedUser,
    businessDate: string
  ): Promise<{
    id: string;
    tenantId: string;
    ledgerId: string;
    year: number;
    month: number;
    startDate: Date;
    endDate: Date;
    status: AccountingPeriodStatus;
  }> {
    const currentPeriod = await this.findCurrentPeriodRecord(user);

    if (!currentPeriod) {
      throw new BadRequestException(
        '현재 Ledger에 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다.'
      );
    }

    const businessMoment = new Date(`${businessDate}T00:00:00.000Z`);
    if (Number.isNaN(businessMoment.getTime())) {
      throw new BadRequestException('businessDate가 올바르지 않습니다.');
    }

    if (
      businessMoment.getTime() < currentPeriod.startDate.getTime() ||
      businessMoment.getTime() >= currentPeriod.endDate.getTime()
    ) {
      throw new BadRequestException(
        '수집 거래 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
      );
    }

    return currentPeriod;
  }

  private async findCurrentPeriodRecord(
    user: AuthenticatedUser
  ): Promise<AccountingPeriodRecord | null> {
    const workspace = requireCurrentWorkspace(user);

    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [...readCollectingAccountingPeriodStatuses()]
        }
      },
      include: accountingPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }
}
