import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  FinancialStatementPayload,
  FinancialStatementsView,
  GenerateFinancialStatementSnapshotsRequest
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  FinancialStatementKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountingPeriodRecordToItem } from '../accounting-periods/accounting-period.mapper';
import { mapFinancialStatementSnapshotRecordToItem } from './financial-statement-snapshot.mapper';

const STATEMENT_KIND_ORDER: FinancialStatementKind[] = [
  FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
  FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
  FinancialStatementKind.CASH_FLOW_SUMMARY,
  FinancialStatementKind.NET_WORTH_MOVEMENT
];

@Injectable()
export class FinancialStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findView(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<FinancialStatementsView | null> {
    const workspace = requireCurrentWorkspace(user);
    const period = await this.resolveTargetPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      periodId
    );

    if (!period) {
      return null;
    }

    const snapshots = await this.prisma.financialStatementSnapshot.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: period.id
      },
      include: {
        period: {
          select: {
            year: true,
            month: true
          }
        }
      }
    });

    return {
      period: mapAccountingPeriodRecordToItem(period),
      snapshots: sortSnapshots(
        snapshots.map(mapFinancialStatementSnapshotRecordToItem)
      )
    };
  }

  async generate(
    user: AuthenticatedUser,
    input: GenerateFinancialStatementSnapshotsRequest
  ): Promise<FinancialStatementsView> {
    const workspace = requireCurrentWorkspace(user);
    this.assertGeneratePermission(workspace.membershipRole);

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: input.periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
        ledger: {
          select: {
            baseCurrency: true
          }
        },
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
      throw new NotFoundException('재무제표를 생성할 운영 기간을 찾을 수 없습니다.');
    }

    if (period.status !== AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '공식 재무제표는 잠금된 운영 기간에 대해서만 생성할 수 있습니다.'
      );
    }

    const closingSnapshot = await this.prisma.closingSnapshot.findUnique({
      where: {
        periodId: period.id
      }
    });

    if (!closingSnapshot) {
      throw new BadRequestException(
        '마감 스냅샷이 없는 운영 기간에는 공식 재무제표를 생성할 수 없습니다.'
      );
    }

    const closingLines = await this.prisma.balanceSnapshotLine.findMany({
      where: {
        closingSnapshotId: closingSnapshot.id
      },
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
    });

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
    });

    const previousLockedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: AccountingPeriodStatus.LOCKED,
        OR: [
          { year: { lt: period.year } },
          {
            year: period.year,
            month: { lt: period.month }
          }
        ]
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: {
        id: true
      }
    });

    const previousClosingSnapshot = previousLockedPeriod
      ? await this.prisma.closingSnapshot.findUnique({
          where: {
            periodId: previousLockedPeriod.id
          }
        })
      : null;

    const payloads = buildStatementPayloads({
      monthLabel: `${period.year}-${String(period.month).padStart(2, '0')}`,
      closingSnapshot,
      closingLines,
      journalLines,
      openingNetWorth:
        previousClosingSnapshot == null
          ? 0
          : previousClosingSnapshot.totalAssetAmount -
            previousClosingSnapshot.totalLiabilityAmount
    });

    for (const [statementKind, payload] of payloads) {
      await this.prisma.financialStatementSnapshot.upsert({
        where: {
          periodId_statementKind: {
            periodId: period.id,
            statementKind
          }
        },
        update: {
          currency: period.ledger.baseCurrency,
          payload
        },
        create: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          statementKind,
          currency: period.ledger.baseCurrency,
          payload
        }
      });
    }

    const snapshots = await this.prisma.financialStatementSnapshot.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: period.id
      },
      include: {
        period: {
          select: {
            year: true,
            month: true
          }
        }
      }
    });

    return {
      period: mapAccountingPeriodRecordToItem(period),
      snapshots: sortSnapshots(
        snapshots.map(mapFinancialStatementSnapshotRecordToItem)
      )
    };
  }

  private assertGeneratePermission(
    membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
  ) {
    if (membershipRole === 'OWNER' || membershipRole === 'MANAGER') {
      return;
    }

    throw new ForbiddenException(
      '공식 재무제표 생성은 Owner 또는 Manager만 실행할 수 있습니다.'
    );
  }

  private async resolveTargetPeriod(
    tenantId: string,
    ledgerId: string,
    periodId?: string
  ) {
    return this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
        ...(periodId
          ? { id: periodId }
          : {
              status: AccountingPeriodStatus.LOCKED
            })
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

function sortSnapshots<T extends { statementKind: FinancialStatementKind }>(
  snapshots: T[]
) {
  return [...snapshots].sort(
    (left, right) =>
      STATEMENT_KIND_ORDER.indexOf(left.statementKind) -
      STATEMENT_KIND_ORDER.indexOf(right.statementKind)
  );
}

function buildStatementPayloads(input: {
  monthLabel: string;
  closingSnapshot: {
    totalAssetAmount: number;
    totalLiabilityAmount: number;
    totalEquityAmount: number;
    periodPnLAmount: number;
  };
  closingLines: Array<{
    balanceAmount: number;
    accountSubject: {
      code: string;
      name: string;
    };
    fundingAccount: {
      name: string;
    } | null;
  }>;
  journalLines: Array<{
    debitAmount: number;
    creditAmount: number;
    accountSubject: {
      code: string;
      name: string;
    };
    fundingAccount: {
      name: string;
    } | null;
  }>;
  openingNetWorth: number;
}): Map<FinancialStatementKind, FinancialStatementPayload> {
  const assets = input.closingLines.filter((line) =>
    line.accountSubject.code.startsWith('1')
  );
  const liabilities = input.closingLines.filter((line) =>
    line.accountSubject.code.startsWith('2')
  );
  const equity = input.closingLines.filter((line) =>
    line.accountSubject.code.startsWith('3')
  );
  const incomeLines = input.closingLines.filter((line) =>
    line.accountSubject.code.startsWith('4')
  );
  const expenseLines = input.closingLines.filter((line) =>
    line.accountSubject.code.startsWith('5')
  );

  const cashFlowByFundingAccount = new Map<string, number>();
  for (const line of input.journalLines) {
    if (!line.accountSubject.code.startsWith('1') || !line.fundingAccount) {
      continue;
    }

    const current = cashFlowByFundingAccount.get(line.fundingAccount.name) ?? 0;
    cashFlowByFundingAccount.set(
      line.fundingAccount.name,
      current + (line.debitAmount - line.creditAmount)
    );
  }

  const operatingCashIn = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => sum + amount, 0);
  const operatingCashOut = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  const netCashFlow = operatingCashIn - operatingCashOut;

  const closingNetWorth =
    input.closingSnapshot.totalAssetAmount -
    input.closingSnapshot.totalLiabilityAmount;

  return new Map([
    [
      FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      {
        summary: [
          { label: '자산 합계', amountWon: input.closingSnapshot.totalAssetAmount },
          {
            label: '부채 합계',
            amountWon: input.closingSnapshot.totalLiabilityAmount
          },
          { label: '자본 합계', amountWon: input.closingSnapshot.totalEquityAmount }
        ],
        sections: [
          {
            title: '자산',
            items: assets.map((line) => ({
              label: buildLineLabel(line.accountSubject.name, line.fundingAccount?.name),
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '부채',
            items: liabilities.map((line) => ({
              label: buildLineLabel(line.accountSubject.name, line.fundingAccount?.name),
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '자본',
            items: equity.map((line) => ({
              label: buildLineLabel(line.accountSubject.name, line.fundingAccount?.name),
              amountWon: line.balanceAmount
            }))
          }
        ],
        notes: [
          `${input.monthLabel} 잠금 기준 ClosingSnapshot을 공식 재산상태표의 근거로 사용합니다.`
        ]
      }
    ],
    [
      FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
      {
        summary: [
          {
            label: '월간 수익',
            amountWon: incomeLines.reduce((sum, line) => sum + line.balanceAmount, 0)
          },
          {
            label: '월간 비용',
            amountWon: expenseLines.reduce((sum, line) => sum + line.balanceAmount, 0)
          },
          { label: '당기 손익', amountWon: input.closingSnapshot.periodPnLAmount }
        ],
        sections: [
          {
            title: '수익',
            items: incomeLines.map((line) => ({
              label: line.accountSubject.name,
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '비용',
            items: expenseLines.map((line) => ({
              label: line.accountSubject.name,
              amountWon: line.balanceAmount
            }))
          }
        ],
        notes: [
          '월간 손익보고서는 잠금된 전표와 마감 스냅샷 기준 금액을 그대로 사용합니다.'
        ]
      }
    ],
    [
      FinancialStatementKind.CASH_FLOW_SUMMARY,
      {
        summary: [
          { label: '현금 유입', amountWon: operatingCashIn },
          { label: '현금 유출', amountWon: operatingCashOut },
          { label: '순현금흐름', amountWon: netCashFlow }
        ],
        sections: [
          {
            title: '자금수단별 순현금흐름',
            items: [...cashFlowByFundingAccount.entries()].map(([label, amountWon]) => ({
              label,
              amountWon
            }))
          }
        ],
        notes: [
          '1차 구현에서는 자금수단(FundingAccount)에 연결된 현금성 자산 라인을 기준으로 요약합니다.'
        ]
      }
    ],
    [
      FinancialStatementKind.NET_WORTH_MOVEMENT,
      {
        summary: [
          { label: '기초 순자산', amountWon: input.openingNetWorth },
          { label: '당기 손익', amountWon: input.closingSnapshot.periodPnLAmount },
          { label: '기말 순자산', amountWon: closingNetWorth }
        ],
        sections: [
          {
            title: '순자산 변동',
            items: [
              { label: '기초 순자산', amountWon: input.openingNetWorth },
              { label: '당기 손익', amountWon: input.closingSnapshot.periodPnLAmount },
              {
                label: '기말 순자산',
                amountWon: closingNetWorth
              }
            ]
          }
        ],
        notes: [
          input.openingNetWorth === 0
            ? '이전 잠금 월이 없어 기초 순자산은 0으로 시작합니다.'
            : '이전 잠금 월의 ClosingSnapshot을 기초 순자산 기준으로 사용합니다.'
        ]
      }
    ]
  ]);
}

function buildLineLabel(
  accountSubjectName: string,
  fundingAccountName: string | null | undefined
) {
  return fundingAccountName
    ? `${accountSubjectName} / ${fundingAccountName}`
    : accountSubjectName;
}
