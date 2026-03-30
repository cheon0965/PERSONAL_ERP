import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { AccountingPeriodStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseMonthRange } from '../../common/utils/date.util';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import {
  compareYearMonth,
  normalizeMonthToken,
  normalizeOptionalText,
  readYearMonth
} from './accounting-period.policy';

@Injectable()
export class OpenAccountingPeriodUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertOpenPermission(workspace.membershipRole);

    const monthToken = normalizeMonthToken(input.month);
    const { start, end } = parseMonthRange(monthToken);
    const { year, month } = readYearMonth(monthToken);

    const existingPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        ledgerId: workspace.ledgerId,
        year,
        month
      }
    });

    if (existingPeriod) {
      throw new ConflictException('해당 월 운영 기간이 이미 존재합니다.');
    }

    const latestPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    const isFirstPeriod = latestPeriod == null;
    const shouldCreateOpeningSnapshot = Boolean(input.initializeOpeningBalance);

    if (isFirstPeriod && !shouldCreateOpeningSnapshot) {
      throw new BadRequestException(
        '첫 월 운영 시작에는 오프닝 잔액 스냅샷 생성이 필요합니다.'
      );
    }

    if (!isFirstPeriod && shouldCreateOpeningSnapshot) {
      throw new BadRequestException(
        '오프닝 잔액 스냅샷 직접 생성은 첫 월 운영 시작에서만 허용합니다.'
      );
    }

    if (latestPeriod) {
      if (latestPeriod.status !== AccountingPeriodStatus.LOCKED) {
        throw new BadRequestException(
          '새 운영 기간을 열기 전에 이전 기간을 먼저 잠가야 합니다.'
        );
      }

      if (
        compareYearMonth(year, month, latestPeriod.year, latestPeriod.month) <=
        0
      ) {
        throw new BadRequestException(
          '새 운영 기간은 최근 운영 기간보다 이후 월이어야 합니다.'
        );
      }
    }

    const createdPeriod = await this.prisma.accountingPeriod.create({
      data: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        year,
        month,
        startDate: start,
        endDate: end,
        status: AccountingPeriodStatus.OPEN
      }
    });

    const createdStatusHistory = await this.prisma.periodStatusHistory.create({
      data: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: createdPeriod.id,
        fromStatus: null,
        toStatus: AccountingPeriodStatus.OPEN,
        reason: normalizeOptionalText(input.note),
        ...actorRef
      }
    });

    const openingBalanceSnapshot = shouldCreateOpeningSnapshot
      ? await this.prisma.openingBalanceSnapshot.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            effectivePeriodId: createdPeriod.id,
            sourceKind: 'INITIAL_SETUP',
            ...createdByActorRef
          },
          select: {
            sourceKind: true
          }
        })
      : null;

    return mapAccountingPeriodRecordToItem({
      ...createdPeriod,
      openingBalanceSnapshot,
      statusHistory: [createdStatusHistory]
    });
  }
}

function assertOpenPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'accounting_period.open');
}
