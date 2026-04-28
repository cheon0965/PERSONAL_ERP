import { Injectable } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  JournalEntryStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type {
  FinancialStatementGenerationContext,
  FinancialStatementGenerationPort
} from '../../application/ports/financial-statement-generation.port';

@Injectable()
export class PrismaFinancialStatementGenerationAdapter implements FinancialStatementGenerationPort {
  constructor(private readonly prisma: PrismaService) {}

  async readGenerationContext(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<FinancialStatementGenerationContext> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        tenantId: true,
        ledgerId: true,
        year: true,
        month: true,
        status: true,
        ledger: {
          select: {
            baseCurrency: true
          }
        }
      }
    });

    if (!period) {
      return {
        period: null,
        closingSnapshot: null,
        closingLines: [],
        journalLines: [],
        previousClosingSnapshot: null
      };
    }

    const closingSnapshot = await this.prisma.closingSnapshot.findUnique({
      where: {
        periodId: period.id
      },
      select: {
        id: true,
        totalAssetAmount: true,
        totalLiabilityAmount: true,
        totalEquityAmount: true,
        periodPnLAmount: true
      }
    });

    const previousLockedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        ledgerId,
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

    const [closingLines, journalLines, previousClosingSnapshot] =
      await Promise.all([
        closingSnapshot
          ? this.prisma.balanceSnapshotLine.findMany({
              where: {
                closingSnapshotId: closingSnapshot.id
              },
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
            })
          : Promise.resolve([]),
        this.prisma.journalLine.findMany({
          where: {
            journalEntry: {
              tenantId,
              ledgerId,
              periodId: period.id,
              status: JournalEntryStatus.POSTED
            }
          },
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
        }),
        previousLockedPeriod
          ? this.prisma.closingSnapshot.findUnique({
              where: {
                periodId: previousLockedPeriod.id
              },
              select: {
                id: true,
                totalAssetAmount: true,
                totalLiabilityAmount: true,
                totalEquityAmount: true,
                periodPnLAmount: true
              }
            })
          : Promise.resolve(null)
      ]);

    return {
      period,
      closingSnapshot,
      closingLines,
      journalLines,
      previousClosingSnapshot
    };
  }

  async upsertStatementSnapshots(
    input: Parameters<
      FinancialStatementGenerationPort['upsertStatementSnapshots']
    >[0]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const [statementKind, payload] of input.payloads) {
        await tx.financialStatementSnapshot.upsert({
          where: {
            periodId_statementKind: {
              periodId: input.periodId,
              statementKind
            }
          },
          update: {
            currency: input.currency,
            payload: payload as Prisma.InputJsonValue
          },
          create: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId,
            periodId: input.periodId,
            statementKind,
            currency: input.currency,
            payload: payload as Prisma.InputJsonValue
          }
        });
      }
    });
  }
}
