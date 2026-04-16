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

@Injectable()
export class CloseAccountingPeriodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodReader: AccountingPeriodReaderPort
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

    const { closingSnapshot, closingLineDrafts } = await this.prisma.$transaction(
      async (tx) => {
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

        const existingClosingSnapshot =
          await tx.closingSnapshot.findUnique({
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
          collectedTransactions,
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
          tx.collectedTransaction.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
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

        const pendingCollectedTransactionCount = collectedTransactions.filter(
          (candidate) =>
            candidate.periodId === currentPeriod.id &&
            (candidate.status === CollectedTransactionStatus.COLLECTED ||
              candidate.status === CollectedTransactionStatus.REVIEWED ||
              candidate.status === CollectedTransactionStatus.READY_TO_POST)
        ).length;

        if (pendingCollectedTransactionCount > 0) {
          throw new BadRequestException(
            `미확정 수집 거래 ${pendingCollectedTransactionCount}건이 남아 있어 운영 기간을 잠글 수 없습니다.`
          );
        }

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

        await tx.periodStatusHistory.create({
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
          closingLineDrafts
        };
      }
    );

    const refreshedPeriod = await this.accountingPeriodReader.findByIdInWorkspace(
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
