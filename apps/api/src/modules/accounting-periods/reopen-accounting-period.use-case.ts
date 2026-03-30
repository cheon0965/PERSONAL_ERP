import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CloseAccountingPeriodRequest
} from '@personal-erp/contracts';
import { AccountingPeriodStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { normalizeOptionalText } from './accounting-period.policy';
import { AccountingPeriodsService } from './accounting-periods.service';

@Injectable()
export class ReopenAccountingPeriodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    assertReopenPermission(workspace.membershipRole);

    const period =
      await this.accountingPeriodsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        periodId
      );

    if (!period) {
      throw new NotFoundException('??? ?? ??? ?? ? ????.');
    }

    if (period.status !== AccountingPeriodStatus.LOCKED) {
      throw new ConflictException('??? ?? ??? ???? ? ????.');
    }

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
        '?? ??? ??? ?? ??? ???? ? ????.'
      );
    }

    const reason = normalizeOptionalText(input.note);

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
          reason,
          ...actorRef
        }
      });
    });

    const refreshedPeriod =
      await this.accountingPeriodsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        period.id
      );

    if (!refreshedPeriod) {
      throw new NotFoundException(
        '???? ?? ??? ?? ???? ?????.'
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
