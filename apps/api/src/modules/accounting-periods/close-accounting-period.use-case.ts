import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  BalanceSnapshotKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { mapClosingSnapshotRecordToItem } from './closing-snapshot.mapper';
import { normalizeOptionalText } from './accounting-period.policy';
import {
  aggregateClosingSnapshotLines,
  summarizeClosingSnapshot
} from './closing-snapshot.policy';
import { AccountingPeriodsService } from './accounting-periods.service';

@Injectable()
export class CloseAccountingPeriodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<CloseAccountingPeriodResponse> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    assertClosePermission(workspace.membershipRole);

    const period =
      await this.accountingPeriodsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        periodId
      );

    if (!period) {
      throw new NotFoundException('마감할 운영 기간을 찾을 수 없습니다.');
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException('이미 잠긴 운영 기간입니다.');
    }

    const existingClosingSnapshot =
      await this.prisma.closingSnapshot.findUnique({
        where: {
          periodId: period.id
        },
        select: {
          id: true
        }
      });

    if (existingClosingSnapshot) {
      throw new ConflictException('이미 마감 스냅샷이 생성된 운영 기간입니다.');
    }

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          status: JournalEntryStatus.POSTED
        }
      },
      include: {
        accountSubject: {
          select: {
            id: true,
            code: true,
            name: true,
            subjectKind: true
          }
        },
        fundingAccount: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (journalLines.length === 0) {
      throw new BadRequestException(
        '마감할 전표가 아직 없어 운영 기간을 잠글 수 없습니다.'
      );
    }

    const closingLineDrafts = aggregateClosingSnapshotLines(journalLines);
    const totals = summarizeClosingSnapshot(closingLineDrafts);
    const lockedAt = new Date();
    const reason = normalizeOptionalText(input.note);

    const closingSnapshot = await this.prisma.$transaction(async (tx) => {
      const createdSnapshot = await tx.closingSnapshot.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          lockedAt,
          totalAssetAmount: totals.totalAssetAmount,
          totalLiabilityAmount: totals.totalLiabilityAmount,
          totalEquityAmount: totals.totalEquityAmount,
          periodPnLAmount: totals.periodPnLAmount
        }
      });

      await tx.balanceSnapshotLine.createMany({
        data: closingLineDrafts.map((line) => ({
          snapshotKind: BalanceSnapshotKind.CLOSING,
          closingSnapshotId: createdSnapshot.id,
          accountSubjectId: line.accountSubjectId,
          fundingAccountId: line.fundingAccountId,
          balanceAmount: line.balanceAmount
        }))
      });

      await tx.accountingPeriod.update({
        where: {
          id: period.id
        },
        data: {
          status: AccountingPeriodStatus.LOCKED,
          lockedAt
        }
      });

      await tx.periodStatusHistory.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          fromStatus: period.status,
          toStatus: AccountingPeriodStatus.LOCKED,
          reason,
          ...actorRef
        }
      });

      return createdSnapshot;
    });

    const refreshedPeriod =
      await this.accountingPeriodsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        period.id
      );

    if (!refreshedPeriod) {
      throw new NotFoundException(
        '마감 이후 운영 기간을 다시 불러오지 못했습니다.'
      );
    }

    return {
      period: mapAccountingPeriodRecordToItem(refreshedPeriod),
      closingSnapshot: mapClosingSnapshotRecordToItem({
        ...closingSnapshot,
        lines: closingLineDrafts.map((line, index) => ({
          id: `closing-line-${index + 1}`,
          accountSubjectCode: line.accountSubjectCode,
          accountSubjectName: line.accountSubjectName,
          fundingAccountName: line.fundingAccountName,
          balanceAmount: line.balanceAmount
        }))
      })
    };
  }
}

function assertClosePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'accounting_period.close');
}
