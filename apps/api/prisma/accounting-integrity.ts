import {
  AccountingPeriodStatus,
  AuditActorType,
  BalanceSnapshotKind,
  FinancialStatementKind,
  OpeningBalanceEquityAdjustmentKind,
  OpeningBalanceSourceKind,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import { fromPrismaMoneyWon } from '../src/common/money/prisma-money';
import {
  aggregateClosingSnapshotLines,
  summarizeClosingSnapshot,
  type AggregatedClosingSnapshotLine
} from '../src/modules/accounting-periods/public';
import { buildStatementPayloads } from '../src/modules/financial-statements/public';

type IntegrityFindingKind = 'REPAIRABLE' | 'BLOCKER';

type IntegrityFinding = {
  kind: IntegrityFindingKind;
  code: string;
  ledgerId: string;
  periodId: string | null;
  message: string;
};

type LedgerAudit = {
  ledgerId: string;
  periodCount: number;
  repairableCount: number;
  blockerCount: number;
  findings: IntegrityFinding[];
};

type AccountingIntegrityReport = {
  runId: string;
  mode: 'AUDIT' | 'REPAIR';
  generatedAt: string;
  ledgerId: string | null;
  ledgers: LedgerAudit[];
  repairedLedgerIds: string[];
  skippedLedgerIds: string[];
  closingEquationConstraintInstalled: boolean;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const STATEMENT_KINDS: FinancialStatementKind[] = [
  FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
  FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
  FinancialStatementKind.CASH_FLOW_SUMMARY,
  FinancialStatementKind.NET_WORTH_MOVEMENT
];

async function readLedgerContext(client: PrismaLike, ledgerId: string) {
  const [ledger, netAssetsSubject, periods] = await Promise.all([
    client.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, tenantId: true, baseCurrency: true }
    }),
    client.accountSubject.findFirst({
      where: { ledgerId, code: '3100' },
      select: {
        id: true,
        code: true,
        name: true,
        subjectKind: true,
        statementType: true,
        normalSide: true,
        isActive: true
      }
    }),
    client.accountingPeriod.findMany({
      where: { ledgerId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: {
        openingBalanceSnapshot: {
          include: {
            lines: {
              include: { accountSubject: true, fundingAccount: true }
            }
          }
        },
        closingSnapshot: {
          include: {
            lines: {
              include: { accountSubject: true, fundingAccount: true }
            }
          }
        },
        carryForwardTargetRecord: true,
        journalEntries: {
          where: { status: 'POSTED' },
          include: {
            lines: {
              include: { accountSubject: true, fundingAccount: true }
            }
          }
        },
        financialStatementSnapshots: true
      }
    })
  ]);

  return { ledger, netAssetsSubject, periods };
}

export async function auditAccountingIntegrity(
  client: PrismaLike,
  ledgerId: string
): Promise<LedgerAudit> {
  const context = await readLedgerContext(client, ledgerId);
  const findings: IntegrityFinding[] = [];
  const addFinding = (
    kind: IntegrityFindingKind,
    code: string,
    periodId: string | null,
    message: string
  ) => findings.push({ kind, code, ledgerId, periodId, message });

  if (!context.ledger) {
    addFinding('BLOCKER', 'LEDGER_NOT_FOUND', null, '장부를 찾을 수 없습니다.');
    return summarizeLedgerAudit(ledgerId, 0, findings);
  }

  if (!isValidNetAssetsSubject(context.netAssetsSubject)) {
    addFinding(
      'BLOCKER',
      'NET_ASSETS_SUBJECT_INVALID',
      null,
      '3100 순자산 계정이 활성 자본/대변/재무상태표 계정으로 구성되지 않았습니다.'
    );
    return summarizeLedgerAudit(ledgerId, context.periods.length, findings);
  }

  let previousClosing:
    | {
        periodId: string;
        snapshotId: string;
        lines: AggregatedClosingSnapshotLine[];
        totals: ReturnType<typeof summarizeClosingSnapshot>;
      }
    | null = null;

  for (let index = 0; index < context.periods.length; index += 1) {
    const period = context.periods[index];
    if (!period) continue;
    const previousPeriod = context.periods[index - 1] ?? null;
    let openingLines = mapSnapshotLines(period.openingBalanceSnapshot?.lines ?? []);

    if (index === 0) {
      if (!period.openingBalanceSnapshot) {
        addFinding(
          'BLOCKER',
          'INITIAL_OPENING_MISSING',
          period.id,
          '최초 운영월의 기초잔액 스냅샷이 없습니다.'
        );
        previousClosing = null;
        continue;
      }
      if (
        period.openingBalanceSnapshot.sourceKind !==
        OpeningBalanceSourceKind.INITIAL_SETUP
      ) {
        addFinding(
          'BLOCKER',
          'INITIAL_OPENING_SOURCE_INVALID',
          period.id,
          '최초 운영월 기초잔액 출처가 INITIAL_SETUP이 아닙니다.'
        );
      }

      const difference = calculateOpeningDifference(openingLines);
      if (difference !== 0) {
        addFinding(
          'REPAIRABLE',
          'INITIAL_OPENING_UNBALANCED',
          period.id,
          `최초 기초잔액 차액 ${difference}원을 3100 순자산으로 보정할 수 있습니다.`
        );
        openingLines = mergeNetAssetsAdjustment(
          openingLines,
          context.netAssetsSubject,
          difference
        );
      }
    } else {
      if (!previousPeriod || !isImmediatelyFollowing(previousPeriod, period)) {
        addFinding(
          'BLOCKER',
          'PERIOD_CHAIN_GAP',
          period.id,
          '운영월 사이에 공백이 있어 차기 이월을 자동 복구할 수 없습니다.'
        );
        previousClosing = null;
        continue;
      }
      if (!previousClosing) {
        addFinding(
          'BLOCKER',
          'PREVIOUS_CLOSING_BASIS_MISSING',
          period.id,
          '직전 운영월의 검증 가능한 마감 기준이 없습니다.'
        );
        continue;
      }

      const expectedOpening = buildCarryForwardLines(
        previousClosing.lines,
        previousClosing.totals.periodPnLAmount,
        context.netAssetsSubject
      );
      const openingSnapshot = period.openingBalanceSnapshot;
      const carryRecord = period.carryForwardTargetRecord;

      if (!openingSnapshot && !carryRecord) {
        addFinding(
          'REPAIRABLE',
          'DIRECT_OPEN_WITHOUT_CARRY_FORWARD',
          period.id,
          '직전 마감에서 다음 월 기초잔액과 이월 기록을 재구성할 수 있습니다.'
        );
      } else if (!openingSnapshot || !carryRecord) {
        addFinding(
          'BLOCKER',
          'PARTIAL_CARRY_FORWARD_CHAIN',
          period.id,
          '기초잔액 스냅샷과 차기 이월 기록 중 하나만 존재합니다.'
        );
      } else if (
        openingSnapshot.sourceKind !== OpeningBalanceSourceKind.CARRY_FORWARD ||
        carryRecord.fromPeriodId !== previousPeriod.id ||
        carryRecord.sourceClosingSnapshotId !== previousClosing.snapshotId
      ) {
        addFinding(
          'BLOCKER',
          'CARRY_FORWARD_RELATION_INVALID',
          period.id,
          '차기 이월의 출발월·도착월·마감 스냅샷 관계가 올바르지 않습니다.'
        );
      } else if (!sameSnapshotLines(openingLines, expectedOpening)) {
        addFinding(
          'REPAIRABLE',
          'CARRY_FORWARD_OPENING_STALE',
          period.id,
          '당기손익이 반영된 직전 마감 기준으로 기초잔액을 재산출해야 합니다.'
        );
      }
      openingLines = expectedOpening;
    }

    let journalsBalanced = true;
    for (const entry of period.journalEntries) {
      const debit = entry.lines.reduce(
        (sum, line) => addMoneyWon(sum, fromPrismaMoneyWon(line.debitAmount)),
        0
      );
      const credit = entry.lines.reduce(
        (sum, line) => addMoneyWon(sum, fromPrismaMoneyWon(line.creditAmount)),
        0
      );
      if (debit !== credit) {
        journalsBalanced = false;
        addFinding(
          'BLOCKER',
          'POSTED_JOURNAL_UNBALANCED',
          period.id,
          `POSTED 전표 ${entry.entryNumber}의 차변과 대변이 일치하지 않습니다.`
        );
      }
    }

    if (!journalsBalanced) {
      previousClosing = null;
      continue;
    }

    const closingLines = aggregateClosingSnapshotLines({
      openingBalanceLines: openingLines,
      journalLines: period.journalEntries.flatMap((entry) =>
        entry.lines.map((line) => ({
          accountSubject: line.accountSubject,
          fundingAccount: line.fundingAccount,
          debitAmount: fromPrismaMoneyWon(line.debitAmount),
          creditAmount: fromPrismaMoneyWon(line.creditAmount)
        }))
      )
    });
    const totals = summarizeClosingSnapshot(closingLines);
    const closingDifference = calculateClosingDifference(totals);
    if (closingDifference !== 0) {
      addFinding(
        'BLOCKER',
        'RECALCULATED_CLOSING_UNBALANCED',
        period.id,
        `원장과 POSTED 전표에서 재계산한 마감 차액이 ${closingDifference}원입니다.`
      );
      previousClosing = null;
      continue;
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      if (!period.closingSnapshot) {
        addFinding(
          'BLOCKER',
          'LOCKED_CLOSING_MISSING',
          period.id,
          '잠금된 운영월에 마감 스냅샷이 없습니다.'
        );
        previousClosing = null;
        continue;
      }

      if (
        !sameClosingSnapshot(period.closingSnapshot, closingLines, totals)
      ) {
        addFinding(
          'REPAIRABLE',
          'CLOSING_SNAPSHOT_STALE',
          period.id,
          '마감 스냅샷 라인 또는 합계가 원장 재계산 결과와 다릅니다.'
        );
      }

      if (period.financialStatementSnapshots.length > 0) {
        const expectedPayloads = buildExpectedStatementPayloads({
          period,
          openingLines,
          closingLines,
          totals
        });
        if (
          period.financialStatementSnapshots.length !== STATEMENT_KINDS.length ||
          period.financialStatementSnapshots.some(
            (snapshot) =>
              stableJson(snapshot.payload) !==
              stableJson(expectedPayloads.get(snapshot.statementKind))
          )
        ) {
          addFinding(
            'REPAIRABLE',
            'FINANCIAL_STATEMENT_SNAPSHOT_STALE',
            period.id,
            '공식 재무제표 스냅샷을 검증된 마감 기준으로 재생성해야 합니다.'
          );
        }
      }

      previousClosing = {
        periodId: period.id,
        snapshotId: period.closingSnapshot.id,
        lines: closingLines,
        totals
      };
    } else {
      if (period.closingSnapshot) {
        addFinding(
          'BLOCKER',
          'UNLOCKED_PERIOD_HAS_CLOSING',
          period.id,
          '잠기지 않은 운영월에 마감 스냅샷이 존재합니다.'
        );
      }
      previousClosing = null;
    }
  }

  return summarizeLedgerAudit(ledgerId, context.periods.length, findings);
}

async function repairLedger(
  prisma: PrismaClient,
  ledgerId: string,
  runId: string,
  reason: string
) {
  const beforeDigest = await digestLedger(prisma, ledgerId);
  await prisma.$transaction(async (tx) => {
    const context = await readLedgerContext(tx, ledgerId);
    if (!context.ledger || !isValidNetAssetsSubject(context.netAssetsSubject)) {
      throw new Error('장부 또는 3100 순자산 계정 기준이 유효하지 않습니다.');
    }

    let previousClosing:
      | {
          periodId: string;
          snapshotId: string;
          lines: AggregatedClosingSnapshotLine[];
          totals: ReturnType<typeof summarizeClosingSnapshot>;
        }
      | null = null;
    let changedPeriods = 0;
    let changedStatements = 0;

    for (let index = 0; index < context.periods.length; index += 1) {
      const period = context.periods[index];
      if (!period) continue;
      const previousPeriod = context.periods[index - 1] ?? null;
      let openingSnapshotId = period.openingBalanceSnapshot?.id ?? null;
      let openingLines = mapSnapshotLines(
        period.openingBalanceSnapshot?.lines ?? []
      );

      if (index === 0) {
        if (!openingSnapshotId) {
          throw new Error('최초 운영월의 기초잔액이 없습니다.');
        }
        const difference = calculateOpeningDifference(openingLines);
        if (difference !== 0) {
          openingLines = mergeNetAssetsAdjustment(
            openingLines,
            context.netAssetsSubject,
            difference
          );
          await replaceOpeningLines(tx, openingSnapshotId, openingLines);
          await tx.openingBalanceSnapshot.update({
            where: { id: openingSnapshotId },
            data: {
              equityAdjustmentKind:
                OpeningBalanceEquityAdjustmentKind.LEGACY_REPAIR,
              equityAdjustmentAmount: difference
            }
          });
          changedPeriods += 1;
        }
      } else {
        if (!previousPeriod || !previousClosing) {
          throw new Error('직전 마감 기준이 없어 차기 이월을 복구할 수 없습니다.');
        }
        const expectedOpening = buildCarryForwardLines(
          previousClosing.lines,
          previousClosing.totals.periodPnLAmount,
          context.netAssetsSubject
        );

        if (!openingSnapshotId) {
          const created = await tx.openingBalanceSnapshot.create({
            data: {
              tenantId: context.ledger.tenantId,
              ledgerId,
              effectivePeriodId: period.id,
              sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
              equityAdjustmentKind:
                OpeningBalanceEquityAdjustmentKind.PERIOD_PNL_ROLLOVER,
              equityAdjustmentAmount: previousClosing.totals.periodPnLAmount,
              createdByActorType: AuditActorType.SYSTEM
            }
          });
          openingSnapshotId = created.id;
          await replaceOpeningLines(tx, openingSnapshotId, expectedOpening);
          openingLines = expectedOpening;
          changedPeriods += 1;
        } else {
          if (!sameSnapshotLines(openingLines, expectedOpening)) {
            await replaceOpeningLines(tx, openingSnapshotId, expectedOpening);
            changedPeriods += 1;
          }
          await tx.openingBalanceSnapshot.update({
            where: { id: openingSnapshotId },
            data: {
              sourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
              equityAdjustmentKind:
                OpeningBalanceEquityAdjustmentKind.PERIOD_PNL_ROLLOVER,
              equityAdjustmentAmount: previousClosing.totals.periodPnLAmount
            }
          });
          openingLines = expectedOpening;
        }

        if (!period.carryForwardTargetRecord) {
          await tx.carryForwardRecord.create({
            data: {
              tenantId: context.ledger.tenantId,
              ledgerId,
              fromPeriodId: previousPeriod.id,
              toPeriodId: period.id,
              sourceClosingSnapshotId: previousClosing.snapshotId,
              createdByActorType: AuditActorType.SYSTEM
            }
          });
        }
      }

      const journalLines = period.journalEntries.flatMap((entry) =>
        entry.lines.map((line) => ({
          accountSubject: line.accountSubject,
          fundingAccount: line.fundingAccount,
          debitAmount: fromPrismaMoneyWon(line.debitAmount),
          creditAmount: fromPrismaMoneyWon(line.creditAmount)
        }))
      );
      const closingLines = aggregateClosingSnapshotLines({
        openingBalanceLines: openingLines,
        journalLines
      });
      const totals = summarizeClosingSnapshot(closingLines);
      if (calculateClosingDifference(totals) !== 0) {
        throw new Error('재계산한 마감 회계등식이 일치하지 않습니다.');
      }

      if (period.status === AccountingPeriodStatus.LOCKED) {
        if (!period.closingSnapshot) {
          throw new Error('잠금된 운영월의 마감 스냅샷이 없습니다.');
        }
        await tx.closingSnapshot.update({
          where: { id: period.closingSnapshot.id },
          data: {
            totalAssetAmount: totals.totalAssetAmount,
            totalLiabilityAmount: totals.totalLiabilityAmount,
            totalEquityAmount: totals.totalEquityAmount,
            periodPnLAmount: totals.periodPnLAmount
          }
        });
        await tx.balanceSnapshotLine.deleteMany({
          where: { closingSnapshotId: period.closingSnapshot.id }
        });
        await tx.balanceSnapshotLine.createMany({
          data: closingLines.map((line) => ({
            snapshotKind: BalanceSnapshotKind.CLOSING,
            closingSnapshotId: period.closingSnapshot!.id,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId,
            balanceAmount: line.balanceAmount
          }))
        });

        if (period.financialStatementSnapshots.length > 0) {
          const payloads = buildExpectedStatementPayloads({
            period,
            openingLines,
            closingLines,
            totals
          });
          for (const kind of STATEMENT_KINDS) {
            await tx.financialStatementSnapshot.upsert({
              where: {
                periodId_statementKind: {
                  periodId: period.id,
                  statementKind: kind
                }
              },
              create: {
                tenantId: context.ledger.tenantId,
                ledgerId,
                periodId: period.id,
                statementKind: kind,
                currency: context.ledger.baseCurrency,
                payload: payloads.get(kind) as Prisma.InputJsonValue
              },
              update: {
                currency: context.ledger.baseCurrency,
                payload: payloads.get(kind) as Prisma.InputJsonValue
              }
            });
            changedStatements += 1;
          }
        }

        previousClosing = {
          periodId: period.id,
          snapshotId: period.closingSnapshot.id,
          lines: closingLines,
          totals
        };
      } else {
        previousClosing = null;
      }
    }

    const afterDigest = await digestLedger(tx, ledgerId);
    await tx.workspaceAuditEvent.create({
      data: {
        tenantId: context.ledger.tenantId,
        ledgerId,
        eventCategory: 'accounting',
        eventName: 'accounting.integrity.repair',
        action: 'repair',
        resourceType: 'Ledger',
        resourceId: ledgerId,
        result: 'SUCCESS',
        reason: reason.slice(0, 191),
        metadata: {
          runId,
          beforeDigest,
          afterDigest,
          changedPeriods,
          changedStatements
        }
      }
    });
  });
}

function buildExpectedStatementPayloads(input: {
  period: Awaited<ReturnType<typeof readLedgerContext>>['periods'][number];
  openingLines: ReturnType<typeof mapSnapshotLines>;
  closingLines: AggregatedClosingSnapshotLine[];
  totals: ReturnType<typeof summarizeClosingSnapshot>;
}) {
  return buildStatementPayloads({
    monthLabel: `${input.period.year}-${String(input.period.month).padStart(2, '0')}`,
    closingSnapshot: input.totals,
    closingLines: input.closingLines.map((line) => ({
      balanceAmount: line.balanceAmount,
      accountSubject: {
        code: line.accountSubjectCode,
        name: line.accountSubjectName,
        subjectKind: line.accountSubjectKind
      },
      fundingAccount: line.fundingAccountName
        ? { name: line.fundingAccountName }
        : null
    })),
    journalLines: input.period.journalEntries.flatMap((entry) =>
      entry.lines.map((line) => ({
        debitAmount: fromPrismaMoneyWon(line.debitAmount),
        creditAmount: fromPrismaMoneyWon(line.creditAmount),
        accountSubject: line.accountSubject,
        fundingAccount: line.fundingAccount
      }))
    ),
    openingNetWorth: subtractMoneyWon(
      sumLines(input.openingLines, 'ASSET'),
      sumLines(input.openingLines, 'LIABILITY')
    )
  });
}

function mapSnapshotLines(
  lines: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: Prisma.Decimal;
    accountSubject: {
      id: string;
      code: string;
      name: string;
      subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    };
    fundingAccount: { id: string; name: string } | null;
  }>
) {
  return lines.map((line) => ({
    accountSubjectId: line.accountSubjectId,
    fundingAccountId: line.fundingAccountId,
    balanceAmount: fromPrismaMoneyWon(line.balanceAmount),
    accountSubject: line.accountSubject,
    fundingAccount: line.fundingAccount
  }));
}

function calculateOpeningDifference(lines: ReturnType<typeof mapSnapshotLines>) {
  return subtractMoneyWon(
    sumLines(lines, 'ASSET'),
    addMoneyWon(sumLines(lines, 'LIABILITY'), sumLines(lines, 'EQUITY'))
  );
}

function calculateClosingDifference(
  totals: ReturnType<typeof summarizeClosingSnapshot>
) {
  return subtractMoneyWon(
    totals.totalAssetAmount,
    addMoneyWon(totals.totalLiabilityAmount, totals.totalEquityAmount)
  );
}

function sumLines(
  lines: ReturnType<typeof mapSnapshotLines>,
  kind: 'ASSET' | 'LIABILITY' | 'EQUITY'
) {
  return lines
    .filter((line) => line.accountSubject.subjectKind === kind)
    .reduce((sum, line) => addMoneyWon(sum, line.balanceAmount), 0);
}

function mergeNetAssetsAdjustment(
  lines: ReturnType<typeof mapSnapshotLines>,
  subject: NonNullable<Awaited<ReturnType<typeof readLedgerContext>>['netAssetsSubject']>,
  adjustment: number
) {
  const next = lines.map((line) => ({ ...line }));
  const existing = next.find(
    (line) => line.accountSubjectId === subject.id && !line.fundingAccountId
  );
  if (existing) {
    existing.balanceAmount = addMoneyWon(existing.balanceAmount, adjustment);
  } else {
    next.push({
      accountSubjectId: subject.id,
      fundingAccountId: null,
      balanceAmount: adjustment,
      accountSubject: {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        subjectKind: 'EQUITY'
      },
      fundingAccount: null
    });
  }
  return next.filter((line) => line.balanceAmount !== 0);
}

function buildCarryForwardLines(
  closingLines: AggregatedClosingSnapshotLine[],
  periodPnLAmount: number,
  subject: NonNullable<Awaited<ReturnType<typeof readLedgerContext>>['netAssetsSubject']>
) {
  const carryable = closingLines
    .filter((line) =>
      ['ASSET', 'LIABILITY', 'EQUITY'].includes(line.accountSubjectKind)
    )
    .map((line) => ({
      accountSubjectId: line.accountSubjectId,
      fundingAccountId: line.fundingAccountId,
      balanceAmount: line.balanceAmount,
      accountSubject: {
        id: line.accountSubjectId,
        code: line.accountSubjectCode,
        name: line.accountSubjectName,
        subjectKind: line.accountSubjectKind as 'ASSET' | 'LIABILITY' | 'EQUITY'
      },
      fundingAccount: line.fundingAccountId
        ? { id: line.fundingAccountId, name: line.fundingAccountName ?? '' }
        : null
    }));
  return mergeNetAssetsAdjustment(carryable, subject, periodPnLAmount);
}

async function replaceOpeningLines(
  tx: Prisma.TransactionClient,
  openingSnapshotId: string,
  lines: ReturnType<typeof mapSnapshotLines>
) {
  await tx.balanceSnapshotLine.deleteMany({ where: { openingSnapshotId } });
  if (lines.length === 0) {
    return;
  }
  await tx.balanceSnapshotLine.createMany({
    data: lines.map((line) => ({
      snapshotKind: BalanceSnapshotKind.OPENING,
      openingSnapshotId,
      accountSubjectId: line.accountSubjectId,
      fundingAccountId: line.fundingAccountId,
      balanceAmount: line.balanceAmount
    }))
  });
}

function sameClosingSnapshot(
  stored: Awaited<ReturnType<typeof readLedgerContext>>['periods'][number]['closingSnapshot'] & {},
  expectedLines: AggregatedClosingSnapshotLine[],
  expectedTotals: ReturnType<typeof summarizeClosingSnapshot>
) {
  if (!stored) return false;
  return (
    fromPrismaMoneyWon(stored.totalAssetAmount) ===
      expectedTotals.totalAssetAmount &&
    fromPrismaMoneyWon(stored.totalLiabilityAmount) ===
      expectedTotals.totalLiabilityAmount &&
    fromPrismaMoneyWon(stored.totalEquityAmount) ===
      expectedTotals.totalEquityAmount &&
    fromPrismaMoneyWon(stored.periodPnLAmount) ===
      expectedTotals.periodPnLAmount &&
    sameSnapshotLines(mapSnapshotLines(stored.lines), expectedLines)
  );
}

function sameSnapshotLines(
  left: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>,
  right: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>
) {
  return lineDigest(left) === lineDigest(right);
}

function lineDigest(
  lines: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>
) {
  return lines
    .map(
      (line) =>
        `${line.accountSubjectId}:${line.fundingAccountId ?? 'none'}:${line.balanceAmount}`
    )
    .sort()
    .join('|');
}

function isImmediatelyFollowing(
  previous: { year: number; month: number },
  next: { year: number; month: number }
) {
  return previous.year * 12 + previous.month + 1 === next.year * 12 + next.month;
}

function isValidNetAssetsSubject(
  subject: Awaited<ReturnType<typeof readLedgerContext>>['netAssetsSubject']
): subject is NonNullable<typeof subject> {
  return Boolean(
    subject &&
      subject.isActive &&
      subject.subjectKind === 'EQUITY' &&
      subject.statementType === 'BALANCE_SHEET' &&
      subject.normalSide === 'CREDIT'
  );
}

function summarizeLedgerAudit(
  ledgerId: string,
  periodCount: number,
  findings: IntegrityFinding[]
): LedgerAudit {
  return {
    ledgerId,
    periodCount,
    repairableCount: findings.filter((item) => item.kind === 'REPAIRABLE')
      .length,
    blockerCount: findings.filter((item) => item.kind === 'BLOCKER').length,
    findings
  };
}

async function digestLedger(client: PrismaLike, ledgerId: string) {
  const data = await client.accountingPeriod.findMany({
    where: { ledgerId },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    include: {
      openingBalanceSnapshot: { include: { lines: true } },
      closingSnapshot: { include: { lines: true } },
      financialStatementSnapshots: true
    }
  });
  return createHash('sha256').update(stableJson(data)).digest('hex');
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value instanceof Prisma.Decimal) {
    return JSON.stringify(value.toString());
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(',')}}`;
}

async function installClosingEquationConstraint(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*) AS count
      FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ClosingSnapshot'
       AND CONSTRAINT_NAME = 'ClosingSnapshot_accounting_equation_chk'
  `);
  if (Number(rows[0]?.count ?? 0) > 0) {
    return false;
  }
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`ClosingSnapshot\`
      ADD CONSTRAINT \`ClosingSnapshot_accounting_equation_chk\`
      CHECK (\`totalAssetAmount\` = \`totalLiabilityAmount\` + \`totalEquityAmount\`)
  `);
  return true;
}

function readFlagValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const reason = readFlagValue('--reason');
  const confirmed = process.argv.includes(
    '--confirm-official-snapshot-rewrite'
  );
  if (apply && (!reason || !confirmed)) {
    throw new Error(
      '복구 적용에는 --reason과 --confirm-official-snapshot-rewrite가 필요합니다.'
    );
  }

  const prisma = new PrismaClient();
  const runId = randomUUID();
  try {
    const ledgerId = readFlagValue('--ledger-id');
    const ledgers = await prisma.ledger.findMany({
      where: ledgerId ? { id: ledgerId } : undefined,
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    const before = [] as LedgerAudit[];
    for (const ledger of ledgers) {
      before.push(await auditAccountingIntegrity(prisma, ledger.id));
    }

    const repairedLedgerIds: string[] = [];
    const skippedLedgerIds: string[] = [];
    if (apply) {
      for (const audit of before) {
        if (audit.blockerCount > 0) {
          skippedLedgerIds.push(audit.ledgerId);
          continue;
        }
        if (audit.repairableCount > 0) {
          await repairLedger(prisma, audit.ledgerId, runId, reason!);
          repairedLedgerIds.push(audit.ledgerId);
        }
      }
    }

    const ledgersAfter = [] as LedgerAudit[];
    for (const ledger of ledgers) {
      ledgersAfter.push(await auditAccountingIntegrity(prisma, ledger.id));
    }
    const remainingFindings = ledgersAfter.flatMap((item) => item.findings);
    let closingEquationConstraintInstalled = false;
    if (apply && remainingFindings.length === 0) {
      closingEquationConstraintInstalled =
        await installClosingEquationConstraint(prisma);
    }

    const report: AccountingIntegrityReport = {
      runId,
      mode: apply ? 'REPAIR' : 'AUDIT',
      generatedAt: new Date().toISOString(),
      ledgerId: ledgerId ?? null,
      ledgers: apply ? ledgersAfter : before,
      repairedLedgerIds,
      skippedLedgerIds,
      closingEquationConstraintInstalled
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    const reportPath = readFlagValue('--report');
    if (reportPath) {
      await writeFile(reportPath, output, 'utf8');
    }
    process.stdout.write(output);
    if (
      (process.argv.includes('--fail-on-findings') || apply) &&
      report.ledgers.some(
        (item) => item.blockerCount > 0 || item.repairableCount > 0
      )
    ) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
