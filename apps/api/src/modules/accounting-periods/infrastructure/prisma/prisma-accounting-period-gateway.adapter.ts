import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountingPeriodStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { readCollectingAccountingPeriodStatuses } from '../../domain/accounting-period-transition.policy';
import { accountingPeriodInclude } from '../models/accounting-period.records';
import type { AccountingPeriodRecord } from '../../application/models/accounting-period-record';
import {
  type AccountingPeriodWorkspaceScope,
  AccountingPeriodReaderPort
} from '../../application/ports/accounting-period-reader.port';
import {
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
      outOfRangeMessage: '수집 거래 일자는 최신 진행월 범위 안에 있어야 합니다.'
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
