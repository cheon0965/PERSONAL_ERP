import { Injectable } from '@nestjs/common';
import {
  conflictError,
  notFoundError,
  validationError
} from '../../../../common/application/errors/app-error';
import type {
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse
} from '@personal-erp/contracts';
import { addMoneyWon } from '@personal-erp/money';
import {
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  BalanceSnapshotKind,
  CollectedTransactionStatus,
  JournalEntryStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { OperationalAuditPublisher } from '../../../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../../../common/infrastructure/operational/period-status-history-audit';
import { fromPrismaMoneyWon } from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AccountingPeriodReaderPort } from '../../application/ports/accounting-period-reader.port';
import { mapAccountingPeriodRecordToItem } from '../../application/mappers/accounting-period.mapper';
import { mapClosingSnapshotRecordToItem } from '../mappers/closing-snapshot.mapper';
import { normalizeOptionalText } from '../../domain/accounting-period.policy';
import { assertAccountingPeriodCanBeClosed } from '../../domain/accounting-period-transition.policy';
import {
  aggregateClosingSnapshotLines,
  assertClosingSnapshotIntegrity,
  assertPostedJournalEntriesBalanced,
  summarizeClosingSnapshot
} from '../../domain/closing-snapshot.policy';
import {
  assertAccountingEquationBalanced,
  summarizeAccountingEquationLines
} from '../../domain/accounting-equation.policy';

/**
 * 운영 기간을 LOCKED로 전환하고 공식 마감 스냅샷을 생성하는 월마감 유스케이스입니다.
 *
 * 마감 스냅샷은 재무제표와 차기 이월의 기준 데이터가 되므로, 미확정 수집 거래가 없는지 확인하고
 * 기초 잔액과 POSTED 전표만 집계합니다. 상태를 먼저 CLOSING으로 선점하는 이유는 같은 월을
 * 두 요청이 동시에 잠그며 서로 다른 스냅샷을 만드는 상황을 막기 위해서입니다.
 */
@Injectable()
export class PrismaCloseAccountingPeriodLifecycle {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodReader: AccountingPeriodReaderPort,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  async execute(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<CloseAccountingPeriodResponse> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    assertClosePermission(workspace.membershipRole);

    const period = await this.accountingPeriodReader.findByIdInWorkspace(
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      periodId
    );

    if (!period) {
      throw notFoundError('마감할 운영 기간을 찾을 수 없습니다.');
    }

    const lockedAt = new Date();
    const reason = normalizeOptionalText(input.note);

    const { closingSnapshot, closingLineDrafts, createdStatusHistory } =
      await this.prisma.$transaction(async (tx) => {
        const currentPeriod = await tx.accountingPeriod.findFirst({
          where: {
            id: period.id,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          }
        });

        if (!currentPeriod) {
          throw notFoundError('마감할 운영 기간을 찾을 수 없습니다.');
        }

        assertAccountingPeriodCanBeClosed(currentPeriod.status);

        // 먼저 CLOSING 상태로 선점해 동일 기간을 두 사용자가 동시에 마감하는 상황을 막는다.
        // 아래 updateMany는 현재 상태까지 조건에 넣어 낙관적 잠금 역할을 한다.
        const claimedPeriod = await tx.accountingPeriod.updateMany({
          where: {
            id: currentPeriod.id,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            status: currentPeriod.status
          },
          data: {
            status: AccountingPeriodStatus.CLOSING
          }
        });

        if (claimedPeriod.count !== 1) {
          const latestPeriod = await tx.accountingPeriod.findFirst({
            where: {
              id: period.id,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            }
          });

          if (!latestPeriod) {
            throw notFoundError('마감할 운영 기간을 찾을 수 없습니다.');
          }

          assertAccountingPeriodCanBeClosed(latestPeriod.status);

          throw conflictError(
            '운영 기간 상태가 변경되어 마감을 완료하지 못했습니다. 다시 시도해 주세요.'
          );
        }

        const existingClosingSnapshot = await tx.closingSnapshot.findUnique({
          where: {
            periodId: currentPeriod.id
          },
          select: {
            id: true
          }
        });

        if (existingClosingSnapshot) {
          throw conflictError('이미 마감 스냅샷이 생성된 운영 기간입니다.');
        }

        const [
          openingBalanceSnapshot,
          pendingCollectedTransactionCount,
          journalLines,
          postedJournalEntries
        ] = await Promise.all([
          tx.openingBalanceSnapshot.findUnique({
            where: {
              effectivePeriodId: currentPeriod.id
            },
            include: {
              lines: {
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
              }
            }
          }),
          tx.collectedTransaction.count({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              periodId: currentPeriod.id,
              status: {
                in: [
                  CollectedTransactionStatus.COLLECTED,
                  CollectedTransactionStatus.REVIEWED,
                  CollectedTransactionStatus.READY_TO_POST
                ]
              }
            }
          }),
          tx.journalLine.findMany({
            where: {
              journalEntry: {
                tenantId: workspace.tenantId,
                ledgerId: workspace.ledgerId,
                periodId: currentPeriod.id,
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
          }),
          tx.journalEntry.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              periodId: currentPeriod.id,
              status: JournalEntryStatus.POSTED
            },
            include: {
              lines: true
            }
          })
        ]);

        // 미확정 거래 누락 위험을 먼저 알려 사용자가 마감 준비 작업을 바로 이어갈 수 있게 한다.
        if (pendingCollectedTransactionCount > 0) {
          throw validationError(
            `미확정 수집 거래 ${pendingCollectedTransactionCount}건이 남아 있어 운영 기간을 잠글 수 없습니다.`
          );
        }

        if (!openingBalanceSnapshot) {
          throw validationError(
            '기초 잔액 스냅샷이 없는 운영 기간은 마감할 수 없습니다.'
          );
        }

        await assertOpeningBalanceChain(tx, {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          period: currentPeriod,
          openingBalanceSnapshot
        });

        const openingEquationTotals = summarizeAccountingEquationLines(
          openingBalanceSnapshot.lines.map((line) => ({
            accountSubjectKind: readOpeningBalanceSubjectKind(
              line.accountSubject.subjectKind
            ),
            balanceAmount: fromPrismaMoneyWon(line.balanceAmount)
          }))
        );
        assertAccountingEquationBalanced(
          openingEquationTotals,
          '기초 잔액 스냅샷의 회계등식이 성립하지 않습니다.'
        );

        assertPostedJournalEntriesBalanced(
          postedJournalEntries
            .filter((entry) => entry.status === JournalEntryStatus.POSTED)
            .map((entry) => ({
              entryNumber: entry.entryNumber,
              debitAmount: entry.lines.reduce(
                (total, line) =>
                  addMoneyWon(total, fromPrismaMoneyWon(line.debitAmount)),
                0
              ),
              creditAmount: entry.lines.reduce(
                (total, line) =>
                  addMoneyWon(total, fromPrismaMoneyWon(line.creditAmount)),
                0
              )
            }))
        );

        // 기초 잔액과 확정 전표 라인을 계정과목/자금수단 단위로 합산해
        // 재무제표와 차기 이월이 공유할 공식 마감 기준을 만든다.
        const closingLineDrafts = aggregateClosingSnapshotLines({
          openingBalanceLines: (openingBalanceSnapshot?.lines ?? []).map(
            (line) => ({
              ...line,
              balanceAmount: fromPrismaMoneyWon(line.balanceAmount)
            })
          ),
          journalLines: journalLines.map((line) => ({
            ...line,
            debitAmount: fromPrismaMoneyWon(line.debitAmount),
            creditAmount: fromPrismaMoneyWon(line.creditAmount)
          }))
        });
        const totals = summarizeClosingSnapshot(closingLineDrafts);
        assertClosingSnapshotIntegrity({
          snapshot: totals,
          lines: closingLineDrafts
        });

        const createdSnapshot = await tx.closingSnapshot.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: currentPeriod.id,
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
            id: currentPeriod.id
          },
          data: {
            status: AccountingPeriodStatus.LOCKED,
            lockedAt
          }
        });

        const createdStatusHistory = await tx.periodStatusHistory.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: currentPeriod.id,
            fromStatus: currentPeriod.status,
            toStatus: AccountingPeriodStatus.LOCKED,
            eventType: AccountingPeriodEventType.LOCK,
            reason,
            ...actorRef
          }
        });

        return {
          closingSnapshot: createdSnapshot,
          closingLineDrafts,
          createdStatusHistory
        };
      });

    publishPeriodStatusHistoryAudit(this.auditPublisher, createdStatusHistory);

    const refreshedPeriod =
      await this.accountingPeriodReader.findByIdInWorkspace(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        period.id
      );

    if (!refreshedPeriod) {
      throw notFoundError('마감 이후 운영 기간을 다시 불러오지 못했습니다.');
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
  return assertWorkspaceActionAllowed(
    membershipRole,
    'accounting_period.close'
  );
}

async function assertOpeningBalanceChain(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    ledgerId: string;
    period: {
      id: string;
      year: number;
      month: number;
    };
    openingBalanceSnapshot: {
      sourceKind: string;
    };
  }
) {
  if (input.openingBalanceSnapshot.sourceKind === 'INITIAL_SETUP') {
    return;
  }

  if (input.openingBalanceSnapshot.sourceKind !== 'CARRY_FORWARD') {
    throw validationError('알 수 없는 기초 잔액 출처로는 마감할 수 없습니다.');
  }

  const carryForwardRecord = await tx.carryForwardRecord.findFirst({
    where: {
      tenantId: input.tenantId,
      ledgerId: input.ledgerId,
      toPeriodId: input.period.id
    }
  });
  if (!carryForwardRecord) {
    throw validationError(
      '차기 이월에서 생성된 기초 잔액과 연결된 이월 기록을 찾을 수 없습니다.'
    );
  }

  const [sourcePeriod, sourceClosingSnapshot] = await Promise.all([
    tx.accountingPeriod.findFirst({
      where: {
        id: carryForwardRecord.fromPeriodId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      }
    }),
    tx.closingSnapshot.findUnique({
      where: {
        periodId: carryForwardRecord.fromPeriodId
      },
      select: {
        id: true
      }
    })
  ]);

  if (!sourcePeriod || sourcePeriod.status !== AccountingPeriodStatus.LOCKED) {
    throw validationError('차기 이월의 원천 운영 기간이 잠금 상태가 아닙니다.');
  }

  const nextYear =
    sourcePeriod.month === 12 ? sourcePeriod.year + 1 : sourcePeriod.year;
  const nextMonth = sourcePeriod.month === 12 ? 1 : sourcePeriod.month + 1;
  if (nextYear !== input.period.year || nextMonth !== input.period.month) {
    throw validationError(
      '기초 잔액 이월 기록이 바로 이전 운영 월과 연결되어 있지 않습니다.'
    );
  }

  if (
    !sourceClosingSnapshot ||
    sourceClosingSnapshot.id !== carryForwardRecord.sourceClosingSnapshotId
  ) {
    throw validationError(
      '차기 이월 기록의 원천 마감 스냅샷 연결이 올바르지 않습니다.'
    );
  }
}

function readOpeningBalanceSubjectKind(subjectKind: string) {
  if (
    subjectKind === 'ASSET' ||
    subjectKind === 'LIABILITY' ||
    subjectKind === 'EQUITY'
  ) {
    return subjectKind;
  }

  throw validationError(
    '기초 잔액 스냅샷에는 재무상태표 계정과목만 포함할 수 있습니다.'
  );
}
