import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import { AccountingPeriodStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { readCollectingAccountingPeriodStatuses } from '../../accounting-period-transition.policy';
import {
  accountingPeriodInclude,
  type AccountingPeriodRecord
} from '../../accounting-period.records';
import {
  type AccountingPeriodWorkspaceScope,
  AccountingPeriodReaderPort
} from '../../application/ports/accounting-period-reader.port';
import {
  type AllocatedJournalEntryNumber,
  AccountingPeriodWriteGuardPort,
  type WritableAccountingPeriod
} from '../../application/ports/accounting-period-write-guard.port';

const journalWritableAccountingPeriodStatuses = [
  AccountingPeriodStatus.OPEN,
  AccountingPeriodStatus.IN_REVIEW
] as const;

@Injectable()
export class PrismaAccountingPeriodGatewayAdapter
  extends AccountingPeriodReaderPort
  implements AccountingPeriodWriteGuardPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllInWorkspace(
    workspace: AccountingPeriodWorkspaceScope
  ): Promise<AccountingPeriodRecord[]> {
    return this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: accountingPeriodInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }

  async findCurrentInWorkspace(
    workspace: AccountingPeriodWorkspaceScope
  ): Promise<AccountingPeriodRecord | null> {
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

  async findByIdInWorkspace(
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<AccountingPeriodRecord | null> {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: accountingPeriodInclude
    });
  }

  async assertCollectingDateAllowed(
    workspace: AccountingPeriodWorkspaceScope,
    businessDate: string
  ): Promise<WritableAccountingPeriod> {
    return this.assertBusinessDateAllowedInWorkspace({
      workspace,
      businessDate,
      allowedStatuses: [...readCollectingAccountingPeriodStatuses()],
      missingPeriodMessage:
        '현재 Ledger에 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다.',
      outOfRangeMessage:
        '수집 거래 일자는 최신 진행월 범위 안에 있어야 합니다.'
    });
  }

  async assertJournalEntryDateAllowed(
    workspace: AccountingPeriodWorkspaceScope,
    businessDate: string
  ): Promise<WritableAccountingPeriod> {
    return this.assertBusinessDateAllowedInWorkspace({
      workspace,
      businessDate,
      allowedStatuses: [...journalWritableAccountingPeriodStatuses],
      missingPeriodMessage:
        '현재 Ledger에 전표 입력 가능한 운영 기간이 없어 조정 전표를 등록할 수 없습니다.',
      outOfRangeMessage:
        '조정 전표 일자는 최신 전표 입력 가능 운영월 범위 안에 있어야 합니다.'
    });
  }

  async claimJournalWritePeriodInTransaction(
    tx: Prisma.TransactionClient,
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<WritableAccountingPeriod> {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
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
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
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
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
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
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<AllocatedJournalEntryNumber> {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
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
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
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
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
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
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
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

  private async assertBusinessDateAllowedInWorkspace(input: {
    workspace: AccountingPeriodWorkspaceScope;
    businessDate: string;
    allowedStatuses: AccountingPeriodStatus[];
    missingPeriodMessage: string;
    outOfRangeMessage: string;
  }): Promise<WritableAccountingPeriod> {
    const businessMoment = parseBusinessMoment(input.businessDate);
    const candidatePeriods = await this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
    const writablePeriods = candidatePeriods.filter((period) =>
      input.allowedStatuses.includes(period.status)
    );

    if (writablePeriods.length === 0) {
      throw new BadRequestException(input.missingPeriodMessage);
    }

    const latestWritablePeriod = writablePeriods[0];

    if (
      !latestWritablePeriod ||
      !isBusinessMomentWithinPeriod(businessMoment, latestWritablePeriod)
    ) {
      throw new BadRequestException(input.outOfRangeMessage);
    }

    return latestWritablePeriod;
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

function parseBusinessMoment(businessDate: string) {
  const businessMoment = new Date(`${businessDate}T00:00:00.000Z`);

  if (Number.isNaN(businessMoment.getTime())) {
    throw new BadRequestException('businessDate가 올바르지 않습니다.');
  }

  return businessMoment;
}

function isBusinessMomentWithinPeriod(
  businessMoment: Date,
  period: WritableAccountingPeriod
) {
  return (
    businessMoment.getTime() >= period.startDate.getTime() &&
    businessMoment.getTime() < period.endDate.getTime()
  );
}
