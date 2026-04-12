import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
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
        eventType: true,
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

  async claimJournalWritePeriodInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ledgerId: string,
    periodId: string
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
    const period = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      }
    });

    if (!period) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    assertJournalWritePeriodClaimable(period.status);

    const claimedPeriod = await tx.accountingPeriod.updateMany({
      where: {
        id: period.id,
        tenantId,
        ledgerId,
        status: period.status
      },
      data: {
        status: period.status
      }
    });

    if (claimedPeriod.count === 1) {
      return period;
    }

    const latestPeriod = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      }
    });

    if (!latestPeriod) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    assertJournalWritePeriodClaimable(latestPeriod.status);

    throw new ConflictException(
      '운영 기간 상태가 변경되어 전표를 기록하지 못했습니다. 다시 시도해 주세요.'
    );
  }

  async allocateJournalEntryNumberInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<{
    period: {
      id: string;
      tenantId: string;
      ledgerId: string;
      year: number;
      month: number;
      startDate: Date;
      endDate: Date;
      status: AccountingPeriodStatus;
    };
    sequence: number;
  }> {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      }
    });

    if (!period) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    assertJournalWritePeriodClaimable(period.status);

    const allocatedPeriod = await tx.accountingPeriod.updateMany({
      where: {
        id: period.id,
        tenantId,
        ledgerId,
        status: {
          in: [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.IN_REVIEW]
        }
      },
      data: {
        nextJournalEntrySequence: {
          increment: 1
        }
      }
    });

    if (allocatedPeriod.count !== 1) {
      const latestPeriod = await tx.accountingPeriod.findFirst({
        where: {
          id: periodId,
          tenantId,
          ledgerId
        }
      });

      if (!latestPeriod) {
        throw new BadRequestException(
          '전표를 기록할 운영 기간을 찾을 수 없습니다.'
        );
      }

      assertJournalWritePeriodClaimable(latestPeriod.status);

      throw new ConflictException(
        '운영 기간 상태가 변경되어 전표 번호를 할당하지 못했습니다. 다시 시도해 주세요.'
      );
    }

    const latestPeriod = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      }
    });

    if (!latestPeriod) {
      throw new BadRequestException(
        '전표를 기록할 운영 기간을 찾을 수 없습니다.'
      );
    }

    return {
      period: latestPeriod,
      sequence: latestPeriod.nextJournalEntrySequence - 1
    };
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

function assertJournalWritePeriodClaimable(
  status: AccountingPeriodStatus
): void {
  if (
    status === AccountingPeriodStatus.OPEN ||
    status === AccountingPeriodStatus.IN_REVIEW
  ) {
    return;
  }

  throw new BadRequestException(
    '현재 운영 기간이 마감 중이거나 잠겨 있어 전표를 기록할 수 없습니다.'
  );
}
