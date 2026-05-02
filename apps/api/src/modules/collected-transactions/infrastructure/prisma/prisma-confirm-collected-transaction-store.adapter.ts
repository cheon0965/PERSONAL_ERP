import { ConflictException, Injectable } from '@nestjs/common';
import {
  CollectedTransactionStatus,
  JournalEntryStatus,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../../../accounting-periods/public';
import type { JournalEntryRecord } from '../../../journal-entries/journal-entry-item.mapper';
import { journalEntryItemInclude } from '../../../journal-entries/journal-entry.record';
import {
  assertConfirmationAllowed,
  assertConfirmationTransactionFound,
  assertConfirmationTransactionHasPeriod
} from '../../confirm-collected-transaction.validator';
import {
  ConfirmCollectedTransactionStorePort,
  ConfirmTransactionContext,
  type AllocatedConfirmationEntryNumber,
  type ConfirmationCollectedTransaction,
  type ConfirmationWorkspaceScope,
  type CreateConfirmationJournalEntryInput
} from '../../application/ports/confirm-collected-transaction-store.port';

/**
 * 수집 거래 확정 포트를 Prisma 트랜잭션 구현으로 연결하는 어댑터입니다.
 *
 * 유스케이스는 "확정에 필요한 회계 상태 전이"만 알고, 이 파일은 실제 Prisma include,
 * 금액 `Decimal` 변환, `updateMany` 기반 낙관적 잠금, 전표 라인 생성 세부사항을 책임집니다.
 */
const confirmationCollectedTransactionInclude = {
  period: {
    select: {
      id: true,
      year: true,
      month: true,
      status: true
    }
  },
  fundingAccount: {
    select: {
      id: true,
      name: true
    }
  },
  ledgerTransactionType: {
    select: {
      postingPolicyKey: true
    }
  },
  matchedPlanItem: {
    select: {
      linkedLiabilityRepayment: {
        select: {
          id: true,
          principalAmount: true,
          interestAmount: true,
          feeAmount: true,
          totalAmount: true,
          postedJournalEntryId: true,
          agreement: {
            select: {
              liabilityAccountSubjectId: true
            }
          }
        }
      }
    }
  },
  importedRow: {
    select: {
      id: true,
      batchId: true,
      rawPayload: true
    }
  },
  postedJournalEntry: {
    select: {
      id: true
    }
  }
} satisfies Prisma.CollectedTransactionInclude;

type PrismaConfirmationRecord = Prisma.CollectedTransactionGetPayload<{
  include: typeof confirmationCollectedTransactionInclude;
}>;

function mapPrismaToConfirmationCollectedTransaction(
  record: PrismaConfirmationRecord
): ConfirmationCollectedTransaction {
  // 유스케이스는 숫자 원화와 최소 관계 정보만 필요하므로 Prisma Decimal과 깊은 관계 구조를 여기서 평평하게 만든다.
  return {
    id: record.id,
    occurredOn: record.occurredOn,
    title: record.title,
    memo: record.memo,
    amount: fromPrismaMoneyWon(record.amount as PrismaMoneyLike),
    status: record.status,
    matchedPlanItemId: record.matchedPlanItemId,
    matchedLiabilityRepaymentSchedule: record.matchedPlanItem
      ?.linkedLiabilityRepayment
      ? {
          id: record.matchedPlanItem.linkedLiabilityRepayment.id,
          principalAmount: fromPrismaMoneyWon(
            record.matchedPlanItem.linkedLiabilityRepayment
              .principalAmount as PrismaMoneyLike
          ),
          interestAmount: fromPrismaMoneyWon(
            record.matchedPlanItem.linkedLiabilityRepayment
              .interestAmount as PrismaMoneyLike
          ),
          feeAmount: fromPrismaMoneyWon(
            record.matchedPlanItem.linkedLiabilityRepayment
              .feeAmount as PrismaMoneyLike
          ),
          totalAmount: fromPrismaMoneyWon(
            record.matchedPlanItem.linkedLiabilityRepayment
              .totalAmount as PrismaMoneyLike
          ),
          postedJournalEntryId:
            record.matchedPlanItem.linkedLiabilityRepayment
              .postedJournalEntryId,
          liabilityAccountSubjectId:
            record.matchedPlanItem.linkedLiabilityRepayment.agreement
              .liabilityAccountSubjectId
        }
      : null,
    period: record.period
      ? {
          id: record.period.id,
          year: record.period.year,
          month: record.period.month,
          status: record.period.status
        }
      : null,
    fundingAccount: {
      id: record.fundingAccount.id,
      name: record.fundingAccount.name
    },
    ledgerTransactionType: {
      postingPolicyKey: record.ledgerTransactionType.postingPolicyKey
    },
    importedRow: record.importedRow
      ? {
          id: record.importedRow.id,
          batchId: record.importedRow.batchId,
          rawPayload: record.importedRow.rawPayload
        }
      : null,
    postedJournalEntry: record.postedJournalEntry
      ? { id: record.postedJournalEntry.id }
      : null
  };
}

@Injectable()
export class PrismaConfirmCollectedTransactionStoreAdapter implements ConfirmCollectedTransactionStorePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {}

  async findForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null> {
    const record = await this.prisma.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      include: confirmationCollectedTransactionInclude
    });

    return record ? mapPrismaToConfirmationCollectedTransaction(record) : null;
  }

  async runInTransaction<T>(
    fn: (ctx: ConfirmTransactionContext) => Promise<T>
  ): Promise<T> {
    // 전표 번호 할당과 수집 거래 선점이 반드시 같은 트랜잭션에서 일어나도록
    // 유스케이스에 Prisma TransactionClient 대신 제한된 컨텍스트만 넘긴다.
    return this.prisma.$transaction(async (tx) => {
      const ctx = new PrismaConfirmTransactionContext(
        tx,
        this.accountingPeriodWriteGuard
      );
      return fn(ctx);
    });
  }
}

class PrismaConfirmTransactionContext extends ConfirmTransactionContext {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {
    super();
  }

  async findLatestForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null> {
    const record = await this.tx.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      include: confirmationCollectedTransactionInclude
    });

    return record ? mapPrismaToConfirmationCollectedTransaction(record) : null;
  }

  async findActiveAccountSubjects(
    scope: ConfirmationWorkspaceScope,
    codes: readonly string[]
  ): Promise<Array<{ id: string; code: string }>> {
    return this.tx.accountSubject.findMany({
      where: {
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId,
        code: { in: [...codes] },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });
  }

  async allocateJournalEntryNumber(
    scope: ConfirmationWorkspaceScope,
    periodId: string
  ): Promise<AllocatedConfirmationEntryNumber> {
    const result =
      await this.accountingPeriodWriteGuard.allocateJournalEntryNumberInTransaction(
        this.tx,
        scope,
        periodId
      );

    return {
      period: {
        id: result.period.id,
        year: result.period.year,
        month: result.period.month
      },
      sequence: result.sequence
    };
  }

  async claimForConfirmation(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    currentStatus: CollectedTransactionStatus;
  }): Promise<{ count: number }> {
    // 상태 조건을 포함한 updateMany로 선점한다.
    // 갱신 건수가 0이면 다른 요청이 먼저 확정/정정/삭제한 것으로 보고 상위에서 충돌 처리한다.
    const result = await this.tx.collectedTransaction.updateMany({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: [input.currentStatus]
        }
      },
      data: {
        status: CollectedTransactionStatus.POSTED
      }
    });

    return { count: result.count };
  }

  async assertClaimSucceeded(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    updatedCount: number;
  }): Promise<void> {
    if (input.updatedCount === 1) {
      return;
    }

    // 실패 원인을 현재 상태 기준으로 다시 검증해 "이미 처리됨"과 "기간 잠김" 같은 도메인 오류를 유지한다.
    const current = await this.tx.collectedTransaction.findFirst({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      },
      include: {
        period: {
          select: {
            id: true,
            year: true,
            month: true,
            status: true
          }
        },
        postedJournalEntry: {
          select: {
            id: true
          }
        }
      }
    });

    assertConfirmationTransactionFound(current);
    assertConfirmationTransactionHasPeriod(current);
    assertConfirmationAllowed({
      status: current.status,
      periodStatus: current.period.status,
      postedJournalEntryId: current.postedJournalEntry?.id ?? null
    });

    throw new ConflictException(
      'Collected transaction changed during confirmation. Please retry.'
    );
  }

  async createJournalEntry(
    input: CreateConfirmationJournalEntryInput
  ): Promise<JournalEntryRecord> {
    return this.tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId,
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        sourceKind: input.sourceKind,
        sourceCollectedTransactionId: input.sourceCollectedTransactionId,
        status: input.status,
        memo: input.memo,
        reversesJournalEntryId: input.reversesJournalEntryId ?? null,
        correctsJournalEntryId: input.correctsJournalEntryId ?? null,
        correctionReason: input.correctionReason ?? null,
        createdByActorType: input.createdByActorType,
        createdByMembershipId: input.createdByMembershipId,
        lines: {
          create: input.lines
        }
      },
      include: journalEntryItemInclude
    });
  }

  async markMatchedPlanItemConfirmed(
    matchedPlanItemId: string | null | undefined
  ): Promise<void> {
    if (!matchedPlanItemId) {
      return;
    }

    await this.tx.planItem.update({
      where: {
        id: matchedPlanItemId
      },
      data: {
        status: PlanItemStatus.CONFIRMED
      }
    });
  }

  async markMatchedLiabilityRepaymentPosted(
    matchedPlanItemId: string | null | undefined,
    journalEntryId: string
  ): Promise<number> {
    if (!matchedPlanItemId) {
      return 0;
    }

    const result = await this.tx.liabilityRepaymentSchedule.updateMany({
      where: {
        linkedPlanItemId: matchedPlanItemId,
        postedJournalEntryId: null
      },
      data: {
        status: LiabilityRepaymentScheduleStatus.POSTED,
        postedJournalEntryId: journalEntryId
      }
    });

    return result.count;
  }

  async findReversalTarget(
    scope: ConfirmationWorkspaceScope,
    importBatchId: string,
    rowNumber: number
  ) {
    const target = await this.tx.importedRow.findFirst({
      where: {
        batchId: importBatchId,
        rowNumber,
        batch: {
          tenantId: scope.tenantId,
          ledgerId: scope.ledgerId
        }
      },
      select: {
        id: true,
        createdCollectedTransaction: {
          select: {
            id: true,
            status: true,
            postedJournalEntry: {
              select: {
                id: true,
                entryNumber: true,
                status: true,
                lines: {
                  select: {
                    accountSubjectId: true,
                    fundingAccountId: true,
                    debitAmount: true,
                    creditAmount: true,
                    description: true
                  },
                  orderBy: {
                    lineNumber: 'asc'
                  }
                }
              }
            }
          }
        }
      }
    });

    return target
      ? {
          id: target.id,
          createdCollectedTransaction: target.createdCollectedTransaction
        }
      : null;
  }

  async updateJournalEntryStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    journalEntryId: string;
    expectedStatuses: JournalEntryStatus[];
    nextStatus: JournalEntryStatus;
  }): Promise<number> {
    const result = await this.tx.journalEntry.updateMany({
      where: {
        id: input.journalEntryId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: input.expectedStatuses
        }
      },
      data: {
        status: input.nextStatus
      }
    });

    return result.count;
  }

  async findCurrentJournalEntryStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null> {
    const current = await this.tx.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      select: {
        status: true
      }
    });

    return current?.status ?? null;
  }

  async updateCollectedTransactionStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    expectedStatuses: CollectedTransactionStatus[];
    nextStatus: CollectedTransactionStatus;
  }): Promise<number> {
    const result = await this.tx.collectedTransaction.updateMany({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: input.expectedStatuses
        }
      },
      data: {
        status: input.nextStatus
      }
    });

    return result.count;
  }

  async findCurrentCollectedTransactionStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatus | null> {
    const current = await this.tx.collectedTransaction.findFirst({
      where: {
        id: collectedTransactionId,
        tenantId: scope.tenantId,
        ledgerId: scope.ledgerId
      },
      select: {
        status: true
      }
    });

    return current?.status ?? null;
  }
}
