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
  AccountingPeriodStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
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
    private readonly accountingPeriodReader: AccountingPeriodReaderPort
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
        }
      }),
      this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          year: nextYear,
          month: nextMonth
        },
        include: {
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
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: {
        id: true
      }
    });

    if (!latestPeriod || latestPeriod.id !== period.id) {
      throw new ConflictException(
        '가장 최근 운영 기간만 재오픈할 수 있습니다.'
      );
    }

    const reason = normalizeOptionalText(input.reason);
    if (!reason) {
      throw new BadRequestException('재오픈 사유를 입력해 주세요.');
    }

    await this.prisma.$transaction(async (tx) => {
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

      await tx.periodStatusHistory.create({
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
