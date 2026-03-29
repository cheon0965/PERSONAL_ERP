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
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import { mapClosingSnapshotRecordToItem } from '../accounting-periods/closing-snapshot.mapper';
import { mapCarryForwardRecordToItem } from './carry-forward.mapper';
import { mapOpeningBalanceSnapshotRecordToItem } from './opening-balance-snapshot.mapper';

@Injectable()
export class CarryForwardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    fromPeriodId?: string
  ): Promise<CarryForwardView | null> {
    if (!fromPeriodId) {
      return null;
    }

    const workspace = requireCurrentWorkspace(user);
    return this.buildView(workspace.tenantId, workspace.ledgerId, fromPeriodId);
  }

  async generate(
    user: AuthenticatedUser,
    input: GenerateCarryForwardRequest
  ): Promise<CarryForwardView> {
    const workspace = requireCurrentWorkspace(user);
    this.assertGeneratePermission(workspace.membershipRole);

    const sourcePeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: input.fromPeriodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
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
      }
    });

    if (!sourcePeriod) {
      throw new NotFoundException('이월 기준이 될 운영 기간을 찾을 수 없습니다.');
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
                name: true
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
      throw new ConflictException('해당 운영 기간의 차기 이월은 이미 생성되었습니다.');
    }

    const { year: nextYear, month: nextMonth, monthLabel } = readNextMonth(
      sourcePeriod.year,
      sourcePeriod.month
    );

    const existingTargetPeriod = await this.prisma.accountingPeriod.findFirst({
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
      }
    });

    if (existingTargetPeriod?.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException(
        '이미 잠금된 다음 운영 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    if (existingTargetPeriod?.openingBalanceSnapshot) {
      throw new ConflictException(
        `${monthLabel} 운영 기간에는 이미 오프닝 잔액 스냅샷이 존재합니다.`
      );
    }

    const carryableLines = sourceClosingSnapshot.lines
      .filter((line) => isCarryForwardAccount(line.accountSubject.code))
      .map((line) => ({
        accountSubjectId: line.accountSubjectId,
        accountSubjectCode: line.accountSubject.code,
        accountSubjectName: line.accountSubject.name,
        fundingAccountId: line.fundingAccountId,
        fundingAccountName: line.fundingAccount?.name ?? null,
        balanceAmount: line.balanceAmount
      }));

    await this.prisma.$transaction(async (tx) => {
      const targetPeriod =
        existingTargetPeriod ??
        (await tx.accountingPeriod.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            year: nextYear,
            month: nextMonth,
            startDate: readPeriodBoundary(nextYear, nextMonth).startDate,
            endDate: readPeriodBoundary(nextYear, nextMonth).endDate,
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

      const carryForwardRecord = await tx.carryForwardRecord.create({
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

      return carryForwardRecord.id;
    });

    const view = await this.buildView(
      workspace.tenantId,
      workspace.ledgerId,
      sourcePeriod.id
    );

    if (!view) {
      throw new NotFoundException('차기 이월 생성 후 결과를 다시 불러오지 못했습니다.');
    }

    return view;
  }

  private assertGeneratePermission(
    membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
  ) {
    if (membershipRole === 'OWNER' || membershipRole === 'MANAGER') {
      return;
    }

    throw new ForbiddenException(
      '차기 이월 생성은 Owner 또는 Manager만 실행할 수 있습니다.'
    );
  }

  private async buildView(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string
  ): Promise<CarryForwardView | null> {
    const carryForwardRecord = await this.prisma.carryForwardRecord.findFirst({
      where: {
        tenantId,
        ledgerId,
        fromPeriodId
      }
    });

    if (!carryForwardRecord) {
      return null;
    }

    const [sourcePeriod, targetPeriod, sourceClosingSnapshot, targetOpeningSnapshot] =
      await Promise.all([
        this.prisma.accountingPeriod.findFirst({
          where: {
            id: carryForwardRecord.fromPeriodId,
            tenantId,
            ledgerId
          },
          include: {
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
          }
        }),
        this.prisma.accountingPeriod.findFirst({
          where: {
            id: carryForwardRecord.toPeriodId,
            tenantId,
            ledgerId
          },
          include: {
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
          }
        }),
        this.prisma.closingSnapshot.findUnique({
          where: {
            periodId: carryForwardRecord.fromPeriodId
          },
          include: {
            lines: {
              include: {
                accountSubject: {
                  select: {
                    code: true,
                    name: true
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
        }),
        this.prisma.openingBalanceSnapshot.findUnique({
          where: {
            effectivePeriodId: carryForwardRecord.toPeriodId
          },
          include: {
            lines: {
              include: {
                accountSubject: {
                  select: {
                    code: true,
                    name: true
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
        })
      ]);

    if (!sourcePeriod || !targetPeriod || !sourceClosingSnapshot || !targetOpeningSnapshot) {
      return null;
    }

    return {
      carryForwardRecord: mapCarryForwardRecordToItem(carryForwardRecord),
      sourcePeriod: mapAccountingPeriodRecordToItem(sourcePeriod),
      sourceClosingSnapshot: mapClosingSnapshotRecordToItem({
        ...sourceClosingSnapshot,
        lines: sourceClosingSnapshot.lines.map((line) => ({
          id: line.id,
          accountSubjectCode: line.accountSubject.code,
          accountSubjectName: line.accountSubject.name,
          fundingAccountName: line.fundingAccount?.name ?? null,
          balanceAmount: line.balanceAmount
        }))
      }),
      targetPeriod: mapAccountingPeriodRecordToItem(targetPeriod),
      targetOpeningBalanceSnapshot: mapOpeningBalanceSnapshotRecordToItem({
        ...targetOpeningSnapshot,
        lines: targetOpeningSnapshot.lines.map((line) => ({
          id: line.id,
          accountSubjectCode: line.accountSubject.code,
          accountSubjectName: line.accountSubject.name,
          fundingAccountName: line.fundingAccount?.name ?? null,
          balanceAmount: line.balanceAmount
        }))
      })
    };
  }
}

function readNextMonth(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    year: nextYear,
    month: nextMonth,
    monthLabel: `${nextYear}-${String(nextMonth).padStart(2, '0')}`
  };
}

function readPeriodBoundary(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate =
    month === 12
      ? new Date(Date.UTC(year + 1, 0, 1))
      : new Date(Date.UTC(year, month, 1));

  return {
    startDate,
    endDate
  };
}

function isCarryForwardAccount(accountSubjectCode: string) {
  return (
    accountSubjectCode.startsWith('1') ||
    accountSubjectCode.startsWith('2') ||
    accountSubjectCode.startsWith('3')
  );
}
