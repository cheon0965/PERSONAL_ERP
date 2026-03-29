import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  BalanceSnapshotKind,
  JournalEntryStatus,
  AccountSubjectKind
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseMonthRange } from '../../common/utils/date.util';
import { mapClosingSnapshotRecordToItem } from './closing-snapshot.mapper';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';

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
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return periods.map(mapAccountingPeriodRecordToItem);
  }

  async findCurrent(user: AuthenticatedUser): Promise<AccountingPeriodItem | null> {
    const currentPeriod = await this.findCurrentPeriodRecord(user);

    return currentPeriod ? mapAccountingPeriodRecordToItem(currentPeriod) : null;
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

  async open(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    this.assertOpenPermission(workspace.membershipRole);

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

      if (compareYearMonth(year, month, latestPeriod.year, latestPeriod.month) <= 0) {
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
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: workspace.membershipId
      }
    });

    const openingBalanceSnapshot = shouldCreateOpeningSnapshot
      ? await this.prisma.openingBalanceSnapshot.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            effectivePeriodId: createdPeriod.id,
            sourceKind: 'INITIAL_SETUP',
            createdByActorType: 'TENANT_MEMBERSHIP',
            createdByMembershipId: workspace.membershipId
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

  async close(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<CloseAccountingPeriodResponse> {
    const workspace = requireCurrentWorkspace(user);
    this.assertClosePermission(workspace.membershipRole);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
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

    if (!period) {
      throw new NotFoundException('마감할 운영 기간을 찾을 수 없습니다.');
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException('이미 잠금된 운영 기간입니다.');
    }

    const existingClosingSnapshot = await this.prisma.closingSnapshot.findUnique({
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

    const transactionResult = await this.prisma.$transaction(async (tx) => {
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
          actorType: AuditActorType.TENANT_MEMBERSHIP,
          actorMembershipId: workspace.membershipId
        }
      });

      return createdSnapshot;
    });

    const refreshedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: period.id,
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

    if (!refreshedPeriod) {
      throw new NotFoundException('마감 이후 운영 기간을 다시 불러오지 못했습니다.');
    }

    return {
      period: mapAccountingPeriodRecordToItem(refreshedPeriod),
      closingSnapshot: mapClosingSnapshotRecordToItem({
        ...transactionResult,
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

  private assertOpenPermission(
    membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
  ) {
    if (membershipRole === 'OWNER' || membershipRole === 'MANAGER') {
      return;
    }

    throw new ForbiddenException(
      '월 운영 시작은 Owner 또는 Manager만 실행할 수 있습니다.'
    );
  }

  private assertClosePermission(
    membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
  ) {
    if (membershipRole === 'OWNER') {
      return;
    }

    throw new ForbiddenException('월 마감은 Owner만 실행할 수 있습니다.');
  }

  private async findCurrentPeriodRecord(user: AuthenticatedUser) {
    const workspace = requireCurrentWorkspace(user);

    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [
            AccountingPeriodStatus.OPEN,
            AccountingPeriodStatus.IN_REVIEW,
            AccountingPeriodStatus.CLOSING
          ]
        }
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
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  }
}

function normalizeMonthToken(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }

  return trimmed;
}

function normalizeOptionalText(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readYearMonth(monthToken: string): { year: number; month: number } {
  const [yearToken, monthTokenPart] = monthToken.split('-');
  const year = Number(yearToken);
  const month = Number(monthTokenPart);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }

  return { year, month };
}

function compareYearMonth(
  leftYear: number,
  leftMonth: number,
  rightYear: number,
  rightMonth: number
): number {
  return leftYear === rightYear ? leftMonth - rightMonth : leftYear - rightYear;
}

type AggregatedClosingSnapshotLine = {
  accountSubjectId: string;
  accountSubjectCode: string;
  accountSubjectName: string;
  accountSubjectKind: AccountSubjectKind;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  balanceAmount: number;
};

function aggregateClosingSnapshotLines(
  journalLines: Array<{
    accountSubject: {
      id: string;
      code: string;
      name: string;
      subjectKind: AccountSubjectKind;
    };
    fundingAccount: {
      id: string;
      name: string;
    } | null;
    debitAmount: number;
    creditAmount: number;
  }>
): AggregatedClosingSnapshotLine[] {
  const grouped = new Map<string, AggregatedClosingSnapshotLine>();

  for (const line of journalLines) {
    const balanceAmount = projectNaturalBalance(
      line.accountSubject.subjectKind,
      line.debitAmount,
      line.creditAmount
    );

    if (balanceAmount === 0) {
      continue;
    }

    const key = `${line.accountSubject.id}:${line.fundingAccount?.id ?? 'none'}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.balanceAmount += balanceAmount;
      continue;
    }

    grouped.set(key, {
      accountSubjectId: line.accountSubject.id,
      accountSubjectCode: line.accountSubject.code,
      accountSubjectName: line.accountSubject.name,
      accountSubjectKind: line.accountSubject.subjectKind,
      fundingAccountId: line.fundingAccount?.id ?? null,
      fundingAccountName: line.fundingAccount?.name ?? null,
      balanceAmount
    });
  }

  return [...grouped.values()].filter((line) => line.balanceAmount !== 0);
}

function summarizeClosingSnapshot(lines: AggregatedClosingSnapshotLine[]) {
  let totalAssetAmount = 0;
  let totalLiabilityAmount = 0;
  let totalEquityBaseAmount = 0;
  let totalIncomeAmount = 0;
  let totalExpenseAmount = 0;

  for (const line of lines) {
    const bucket = line.accountSubjectKind;

    switch (bucket) {
      case 'ASSET':
        totalAssetAmount += line.balanceAmount;
        break;
      case 'LIABILITY':
        totalLiabilityAmount += line.balanceAmount;
        break;
      case 'EQUITY':
        totalEquityBaseAmount += line.balanceAmount;
        break;
      case 'INCOME':
        totalIncomeAmount += line.balanceAmount;
        break;
      case 'EXPENSE':
        totalExpenseAmount += line.balanceAmount;
        break;
      default:
        break;
    }
  }

  const periodPnLAmount = totalIncomeAmount - totalExpenseAmount;
  const totalEquityAmount = totalEquityBaseAmount + periodPnLAmount;

  return {
    totalAssetAmount,
    totalLiabilityAmount,
    totalEquityAmount,
    periodPnLAmount
  };
}

function projectNaturalBalance(
  subjectKind: AccountSubjectKind,
  debitAmount: number,
  creditAmount: number
) {
  switch (subjectKind) {
    case 'LIABILITY':
    case 'EQUITY':
    case 'INCOME':
      return creditAmount - debitAmount;
    case 'ASSET':
    case 'EXPENSE':
    default:
      return debitAmount - creditAmount;
  }
}

