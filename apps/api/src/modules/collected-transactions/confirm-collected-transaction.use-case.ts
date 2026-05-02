import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  JournalEntryItem
} from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { readParsedImportedRowPayload } from '../import-batches/import-batch.policy';
import { mapJournalEntryRecordToItem } from '../journal-entries/public';
import {
  assertBalancedJournalAdjustmentLines,
  buildReversalJournalLines
} from '../journal-entries/journal-entry-adjustment.policy';
import { assertJournalEntryCanBeReversed } from '../journal-entries/journal-entry-transition.policy';
import { assertCollectedTransactionCanBeCorrected } from './public';
import {
  ConfirmCollectedTransactionStorePort,
  type ConfirmationCollectedTransaction,
  type ConfirmTransactionContext
} from './application/ports/confirm-collected-transaction-store.port';
import { REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES } from './confirm-collected-transaction.policy';
import {
  assertConfirmationAllowed,
  assertConfirmationTransactionFound,
  assertConfirmationTransactionHasPeriod
} from './confirm-collected-transaction.validator';
import {
  buildConfirmationEntryNumber,
  buildConfirmationJournalLines,
  resolveConfirmationAccountSubjectIds
} from './confirm-collected-transaction.factory';

/**
 * 수집 거래를 공식 회계 전표로 승격하는 핵심 유스케이스입니다.
 *
 * 이 흐름은 거래 화면, 업로드 승격, 계획 항목, 부채 상환이 만나는 지점입니다.
 * 그래서 단순히 JournalEntry를 생성하는 데서 끝내지 않고, 전표 번호 선점,
 * 수집 거래 상태 변경, 계획/부채 상태 갱신, 승인취소 반전 처리까지 한 트랜잭션 경계로 묶습니다.
 */
@Injectable()
export class ConfirmCollectedTransactionUseCase {
  constructor(
    private readonly confirmStore: ConfirmCollectedTransactionStorePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    collectedTransactionId: string
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.confirm'
    );

    // 트랜잭션 밖에서 먼저 빠른 검증을 수행해 사용자에게 즉시 이해 가능한 오류를 돌려준다.
    // 실제 저장 직전에는 runInTransaction 안에서 최신 상태를 다시 검증한다.
    const collectedTransaction = await this.confirmStore.findForConfirmation(
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      collectedTransactionId
    );
    assertConfirmationTransactionFound(collectedTransaction);
    assertConfirmationTransactionHasPeriod(collectedTransaction);

    const period = collectedTransaction.period;
    assertConfirmationAllowed({
      status: collectedTransaction.status,
      periodStatus: period.status,
      postedJournalEntryId: collectedTransaction.postedJournalEntry?.id ?? null
    });

    // 업로드에서 들어온 승인취소 행은 일반 수입/지출 전표가 아니라
    // 원전표를 반전하는 특수 흐름이므로 기본 계정과목 매핑을 건너뛴다.
    const supportsImportedReversal =
      isImportedReversalTransaction(collectedTransaction);
    const accountSubjectIds = supportsImportedReversal
      ? null
      : resolveConfirmationAccountSubjectIds(
          await this.confirmStore.findActiveAccountSubjects(
            {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES
          )
        );

    const journalEntry = await this.confirmStore.runInTransaction(
      async (ctx) => {
        // 확정 직전 최신 상태를 다시 읽는다. 사용자가 목록에서 본 상태와 실제 DB 상태가
        // 달라졌을 수 있으므로 트랜잭션 안에서 한 번 더 검증한다.
        const latestCollectedTransaction = await ctx.findLatestForConfirmation(
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          collectedTransaction.id
        );
        assertConfirmationTransactionFound(latestCollectedTransaction);
        assertConfirmationTransactionHasPeriod(latestCollectedTransaction);

        const latestPeriod = latestCollectedTransaction.period;
        assertConfirmationAllowed({
          status: latestCollectedTransaction.status,
          periodStatus: latestPeriod.status,
          postedJournalEntryId:
            latestCollectedTransaction.postedJournalEntry?.id ?? null
        });

        // 전표 번호는 기간별 순번 리소스다. 번호를 할당한 뒤 수집 거래를 선점해
        // 동일 거래가 중복 확정되는 경쟁 조건을 막는다.
        const allocatedEntryNumber = await ctx.allocateJournalEntryNumber(
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          latestPeriod.id
        );

        const claimedCollectedTransaction = await ctx.claimForConfirmation({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          collectedTransactionId: latestCollectedTransaction.id,
          currentStatus: latestCollectedTransaction.status
        });

        await ctx.assertClaimSucceeded({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          collectedTransactionId: collectedTransaction.id,
          updatedCount: claimedCollectedTransaction.count
        });

        const entryNumber = buildConfirmationEntryNumber({
          year: allocatedEntryNumber.period.year,
          month: allocatedEntryNumber.period.month,
          sequence: allocatedEntryNumber.sequence
        });

        // 승인취소 업로드 행은 원전표의 회계 라인을 뒤집는 별도 경로다.
        // 일반 수입/지출 라인 생성과 섞지 않아야 금액 부호와 원전표 상태 변경을 안전하게 처리할 수 있다.
        if (isImportedReversalTransaction(latestCollectedTransaction)) {
          return this.confirmImportedReversalTransaction({
            ctx,
            workspace: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            collectedTransaction: latestCollectedTransaction,
            periodId: allocatedEntryNumber.period.id,
            entryNumber,
            createdByActorRef
          });
        }

        const journalLines = buildConfirmationJournalLines({
          collectedTransaction: latestCollectedTransaction,
          accountSubjectIds: accountSubjectIds!
        });

        // 수집 거래 확정의 공식 산출물은 POSTED 전표다.
        // 계획 항목/부채 상환과 연결된 상태 갱신까지 같은 트랜잭션 안에서 완료한다.
        const created = await ctx.createJournalEntry({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: allocatedEntryNumber.period.id,
          entryNumber,
          entryDate: latestCollectedTransaction.occurredOn,
          sourceKind: JournalEntrySourceKind.COLLECTED_TRANSACTION,
          sourceCollectedTransactionId: latestCollectedTransaction.id,
          status: JournalEntryStatus.POSTED,
          memo:
            latestCollectedTransaction.memo ?? latestCollectedTransaction.title,
          ...createdByActorRef,
          lines: journalLines
        });

        await ctx.markMatchedPlanItemConfirmed(
          latestCollectedTransaction.matchedPlanItemId
        );
        const liabilityRepaymentUpdatedCount =
          await ctx.markMatchedLiabilityRepaymentPosted(
            latestCollectedTransaction.matchedPlanItemId,
            created.id
          );

        if (
          latestCollectedTransaction.matchedLiabilityRepaymentSchedule &&
          liabilityRepaymentUpdatedCount !== 1
        ) {
          throw new ConflictException(
            '부채 상환 스케줄 상태 갱신에 실패했습니다.'
          );
        }

        return created;
      }
    );

    return mapJournalEntryRecordToItem(journalEntry);
  }

  private async confirmImportedReversalTransaction(input: {
    ctx: ConfirmTransactionContext;
    workspace: {
      tenantId: string;
      ledgerId: string;
    };
    collectedTransaction: ConfirmationCollectedTransaction;
    periodId: string;
    entryNumber: string;
    createdByActorRef: ReturnType<typeof readWorkspaceCreatedByActorRef>;
  }) {
    // 승인취소 행은 rawPayload에 원거래 행 번호를 보관한다.
    // 이 정보를 통해 같은 배치 안의 원거래를 찾고, 원전표가 POSTED 상태일 때만 반전 전표를 생성한다.
    const reversalTargetRowNumber = readImportedReversalTargetRowNumber(
      input.collectedTransaction.importedRow?.rawPayload
    );

    if (
      reversalTargetRowNumber == null ||
      input.collectedTransaction.importedRow == null
    ) {
      throw new BadRequestException(
        '승인취소 업로드 행의 원거래 후보 정보를 읽을 수 없습니다.'
      );
    }

    const target = await input.ctx.findReversalTarget(
      input.workspace,
      input.collectedTransaction.importedRow.batchId,
      reversalTargetRowNumber
    );

    if (!target?.createdCollectedTransaction) {
      throw new BadRequestException(
        '승인취소 대상 원거래를 먼저 수집 거래로 등록해 주세요.'
      );
    }

    const originalCollectedTransaction = target.createdCollectedTransaction;
    const originalJournalEntry =
      originalCollectedTransaction.postedJournalEntry ?? null;

    // 승인취소 행은 원거래가 수집 거래와 전표까지 확정되어 있어야 반전할 수 있다.
    // 원전표가 없으면 어떤 회계 라인을 뒤집어야 할지 알 수 없다.
    if (!originalJournalEntry) {
      throw new BadRequestException(
        '승인취소 전표를 만들기 전에 원거래를 먼저 전표 확정해 주세요.'
      );
    }

    assertJournalEntryCanBeReversed(originalJournalEntry.status);

    // 반전 전표는 원전표의 차변/대변을 그대로 뒤집어 만든다.
    // 생성 전에 대차가 맞는지 한 번 더 확인해 조정 전표의 균형을 보장한다.
    const reversalLines = buildReversalJournalLines(
      originalJournalEntry.lines.map((line) => ({
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description
      }))
    );
    assertBalancedJournalAdjustmentLines(reversalLines);

    const reversedJournalEntryCount =
      await input.ctx.updateJournalEntryStatusInWorkspace({
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        journalEntryId: originalJournalEntry.id,
        expectedStatuses: [originalJournalEntry.status],
        nextStatus: JournalEntryStatus.REVERSED
      });

    // 원전표와 원수집거래 상태를 기대 상태 조건으로 갱신해 동시 반전/정정을 방지한다.
    if (reversedJournalEntryCount !== 1) {
      const currentJournalEntryStatus =
        await input.ctx.findCurrentJournalEntryStatusInWorkspace(
          input.workspace,
          originalJournalEntry.id
        );

      if (!currentJournalEntryStatus) {
        throw new NotFoundException('Original journal entry not found.');
      }

      assertJournalEntryCanBeReversed(currentJournalEntryStatus);

      throw new ConflictException(
        'Original journal entry changed during reversal confirmation. Please retry.'
      );
    }

    const correctedCollectedTransactionCount =
      await input.ctx.updateCollectedTransactionStatusInWorkspace({
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        collectedTransactionId: originalCollectedTransaction.id,
        expectedStatuses: [originalCollectedTransaction.status],
        nextStatus: CollectedTransactionStatus.CORRECTED
      });

    if (correctedCollectedTransactionCount !== 1) {
      const currentCollectedTransactionStatus =
        await input.ctx.findCurrentCollectedTransactionStatusInWorkspace(
          input.workspace,
          originalCollectedTransaction.id
        );

      if (!currentCollectedTransactionStatus) {
        throw new NotFoundException(
          'Original collected transaction not found.'
        );
      }

      assertCollectedTransactionCanBeCorrected(
        currentCollectedTransactionStatus
      );

      throw new ConflictException(
        'Original collected transaction changed during reversal confirmation. Please retry.'
      );
    }

    return input.ctx.createJournalEntry({
      tenantId: input.workspace.tenantId,
      ledgerId: input.workspace.ledgerId,
      periodId: input.periodId,
      entryNumber: input.entryNumber,
      entryDate: input.collectedTransaction.occurredOn,
      sourceKind: JournalEntrySourceKind.MANUAL_ADJUSTMENT,
      sourceCollectedTransactionId: input.collectedTransaction.id,
      status: JournalEntryStatus.POSTED,
      memo:
        input.collectedTransaction.memo ??
        `${input.collectedTransaction.title} 승인취소`,
      reversesJournalEntryId: originalJournalEntry.id,
      ...input.createdByActorRef,
      lines: reversalLines
    });
  }
}

function isImportedReversalTransaction(
  collectedTransaction: ConfirmationCollectedTransaction
): boolean {
  // 업로드 파서가 승인취소 후보로 분류한 행은 MANUAL_ADJUSTMENT 정책을 사용한다.
  // 가져온 행 존재 여부까지 함께 확인해 수기 조정 거래와 구분한다.
  return (
    collectedTransaction.ledgerTransactionType.postingPolicyKey ===
      'MANUAL_ADJUSTMENT' && collectedTransaction.importedRow != null
  );
}

function readImportedReversalTargetRowNumber(
  rawPayload: unknown
): number | null {
  const parsed = readParsedImportedRowPayload(rawPayload as never);

  return parsed?.collectTypeHint === 'REVERSAL' &&
    Number.isInteger(parsed.reversalTargetRowNumber)
    ? (parsed.reversalTargetRowNumber ?? null)
    : null;
}
