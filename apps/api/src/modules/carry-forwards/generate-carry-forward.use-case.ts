import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CarryForwardView,
  GenerateCarryForwardRequest
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  BalanceSnapshotKind,
  OpeningBalanceSourceKind
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  isCarryForwardAccount,
  readNextMonth,
  readPeriodBoundary
} from './carry-forward.policy';
import { CarryForwardsService } from './carry-forwards.service';

@Injectable()
export class GenerateCarryForwardUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carryForwardsService: CarryForwardsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: GenerateCarryForwardRequest
  ): Promise<CarryForwardView> {
    const workspace = requireCurrentWorkspace(user);
    assertGeneratePermission(workspace.membershipRole);

    const sourcePeriod =
      await this.carryForwardsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        input.fromPeriodId
      );

    if (!sourcePeriod) {
      throw new NotFoundException(
        '이월 기준이 되는 운영 기간을 찾을 수 없습니다.'
      );
    }

    if (sourcePeriod.status !== AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '차기 이월은 잠금된 운영 기간에 대해서만 생성할 수 있습니다.'
      );
    }

    const sourceClosingSnapshot = await this.prisma.closingSnapshot.findUnique({
      where: {
        periodId: sourcePeriod.id
      },
      include: {
        lines: {
          include: {
            accountSubject: {
              select: {
                code: true,
                name: true,
                subjectKind: true
              }
            },
            fundingAccount: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!sourceClosingSnapshot) {
      throw new BadRequestException(
        '마감 스냅샷이 없는 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    const existingRecord = await this.prisma.carryForwardRecord.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        fromPeriodId: sourcePeriod.id
      }
    });

    if (existingRecord) {
      throw new ConflictException(
        '해당 운영 기간의 차기 이월이 이미 생성되었습니다.'
      );
    }

    const {
      year: nextYear,
      month: nextMonth,
      monthLabel
    } = readNextMonth(sourcePeriod.year, sourcePeriod.month);

    const existingTargetPeriod =
      await this.carryForwardsService.findPeriodByYearMonthInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        nextYear,
        nextMonth
      );

    if (existingTargetPeriod?.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException(
        '이미 잠금된 다음 운영 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    if (existingTargetPeriod?.openingBalanceSnapshot) {
      throw new ConflictException(
        `${monthLabel} 운영 기간에는 이미 오프닝 밸런스 스냅샷이 존재합니다.`
      );
    }

    const carryableLines = sourceClosingSnapshot.lines
      .filter((line) => isCarryForwardAccount(line.accountSubject.subjectKind))
      .map((line) => ({
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        balanceAmount: line.balanceAmount
      }));

    const nextPeriodBoundary = readPeriodBoundary(nextYear, nextMonth);

    await this.prisma.$transaction(async (tx) => {
      const targetPeriod =
        existingTargetPeriod ??
        (await tx.accountingPeriod.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            year: nextYear,
            month: nextMonth,
            startDate: nextPeriodBoundary.startDate,
            endDate: nextPeriodBoundary.endDate,
            status: AccountingPeriodStatus.OPEN
          }
        }));

      if (!existingTargetPeriod) {
        await tx.periodStatusHistory.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: targetPeriod.id,
            fromStatus: null,
            toStatus: AccountingPeriodStatus.OPEN,
            reason: `${sourcePeriod.year}-${String(sourcePeriod.month).padStart(2, '0')} 이월 생성`,
            actorType: AuditActorType.TENANT_MEMBERSHIP,
            actorMembershipId: workspace.membershipId
          }
        });
      }

      const openingBalanceSnapshot = await tx.openingBalanceSnapshot.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          effectivePeriodId: targetPeriod.id,
          sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
          createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
          createdByMembershipId: workspace.membershipId
        }
      });

      if (carryableLines.length > 0) {
        await tx.balanceSnapshotLine.createMany({
          data: carryableLines.map((line) => ({
            snapshotKind: BalanceSnapshotKind.OPENING,
            openingSnapshotId: openingBalanceSnapshot.id,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId,
            balanceAmount: line.balanceAmount
          }))
        });
      }

      await tx.carryForwardRecord.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          fromPeriodId: sourcePeriod.id,
          toPeriodId: targetPeriod.id,
          sourceClosingSnapshotId: sourceClosingSnapshot.id,
          createdJournalEntryId: null,
          createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
          createdByMembershipId: workspace.membershipId
        }
      });
    });

    const view = await this.carryForwardsService.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      sourcePeriod.id
    );

    if (!view) {
      throw new NotFoundException(
        '차기 이월 생성 결과를 다시 불러오지 못했습니다.'
      );
    }

    return view;
  }
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  if (membershipRole === 'OWNER' || membershipRole === 'MANAGER') {
    return;
  }

  throw new ForbiddenException(
    '차기 이월 생성은 Owner 또는 Manager만 실행할 수 있습니다.'
  );
}
