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
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  BalanceSnapshotKind,
  CollectedTransactionStatus,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { OperationalAuditPublisher } from '../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../common/infrastructure/operational/period-status-history-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodReaderPort } from './application/ports/accounting-period-reader.port';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { mapClosingSnapshotRecordToItem } from './closing-snapshot.mapper';
import { normalizeOptionalText } from './accounting-period.policy';
import { assertAccountingPeriodCanBeClosed } from './accounting-period-transition.policy';
import {
  aggregateClosingSnapshotLines,
  summarizeClosingSnapshot
} from './closing-snapshot.policy';

/**
 * 운영 기간을 LOCKED로 전환하고 공식 마감 스냅샷을 생성하는 월마감 유스케이스입니다.
 *
 * 마감 스냅샷은 재무제표와 차기 이월의 기준 데이터가 되므로, 미확정 수집 거래가 없는지 확인하고
 * 기초 잔액과 POSTED 전표만 집계합니다. 상태를 먼저 CLOSING으로 선점하는 이유는 같은 월을
 * 두 요청이 동시에 잠그며 서로 다른 스냅샷을 만드는 상황을 막기 위해서입니다.
 */
@Injectable()
export class CloseAccountingPeriodUseCase {
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
      throw new NotFoundException('마감할 운영 기간을 찾을 수 없습니다.');
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
          throw new NotFoundException('마감할 운영 기간을 찾을 수 없습니다.');
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
            throw new NotFoundException('마감할 운영 기간을 찾을 수 없습니다.');
          }

          assertAccountingPeriodCanBeClosed(latestPeriod.status);

          throw new ConflictException(
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
          throw new ConflictException(
            '이미 마감 스냅샷이 생성된 운영 기간입니다.'
          );
        }

        const [
          openingBalanceSnapshot,
          pendingCollectedTransactionCount,
          journalLines
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
          })
        ]);

        // 미확정 수집 거래가 남아 있으면 공식 스냅샷을 만들 수 없다.
        // 마감 스냅샷은 POSTED 전표만 기준으로 삼기 때문에 여기서 누락 위험을 차단한다.
        if (pendingCollectedTransactionCount > 0) {
          throw new BadRequestException(
            `미확정 수집 거래 ${pendingCollectedTransactionCount}건이 남아 있어 운영 기간을 잠글 수 없습니다.`
          );
        }

        // 기초 잔액과 확정 전표 라인을 계정과목/자금수단 단위로 합산해
        // 재무제표와 차기 이월이 공유할 공식 마감 기준을 만든다.
        const closingLineDrafts = aggregateClosingSnapshotLines({
          openingBalanceLines: openingBalanceSnapshot?.lines ?? [],
          journalLines
        });
        const totals = summarizeClosingSnapshot(closingLineDrafts);

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
  return assertWorkspaceActionAllowed(
    membershipRole,
    'accounting_period.close'
  );
}
