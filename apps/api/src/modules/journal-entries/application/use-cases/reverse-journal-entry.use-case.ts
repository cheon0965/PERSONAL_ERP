import { ApplicationService } from '../../../../common/application/application-service.decorator';
import {
  conflictError,
  notFoundError,
  validationError
} from '../../../../common/application/errors/app-error';
import type {
  AuthenticatedUser,
  JournalEntryItem,
  ReverseJournalEntryRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { AccountingPeriodWriteGuardPort } from '../../../accounting-periods/public';
import { assertCollectedTransactionCanBeCorrected } from '../../../collected-transactions/public';
import { JournalEntryAdjustmentStorePort } from '../ports/journal-entry-adjustment-store.port';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  buildReversalJournalLines,
  normalizeOptionalText
} from '../../domain/journal-entry-adjustment.policy';
import { assertJournalEntryCanBeReversed } from '../../domain/journal-entry-transition.policy';

/**
 * 게시된 전표를 삭제하지 않고 반대 분개 전표로 되돌리는 유스케이스입니다.
 *
 * 회계 이력은 원장을 직접 수정하지 않는 것이 중요하므로 원전표는 REVERSED로 표시하고,
 * 차변/대변을 뒤집은 새 POSTED 전표를 생성합니다. 수집 거래에서 출발한 전표라면 원수집거래도 CORRECTED로 내려
 * 운영 화면과 회계 장부의 상태가 함께 움직이게 합니다.
 */
@ApplicationService()
export class ReverseJournalEntryUseCase {
  constructor(
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort,
    private readonly journalEntryAdjustmentStore: JournalEntryAdjustmentStorePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    journalEntryId: string,
    input: ReverseJournalEntryRequest
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const workspaceScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'journal_entry.reverse'
    );

    const targetPeriod =
      await this.accountingPeriodWriteGuard.assertJournalEntryDateAllowed(
        workspaceScope,
        input.entryDate
      );

    const reason = normalizeOptionalText(input.reason);

    return this.journalEntryAdjustmentStore.runInTransaction(async (ctx) => {
      // 반전 전표도 일반 전표와 같은 기간별 순번을 사용한다.
      // 대상 기간 쓰기 가능 여부는 트랜잭션 밖에서 확인하고, 번호 할당은 트랜잭션 안에서 확정한다.
      const allocatedEntryNumber = await ctx.allocateJournalEntryNumber(
        workspaceScope,
        targetPeriod.id
      );

      const originalJournalEntry = await ctx.findByIdInWorkspace(
        workspaceScope,
        journalEntryId
      );

      if (!originalJournalEntry) {
        throw notFoundError('Journal entry not found.');
      }

      assertJournalEntryCanBeReversed(originalJournalEntry.status);

      // 반전은 원전표를 수정하지 않고 새 전표를 추가하는 방식이다.
      // 원전표 라인의 차변/대변을 뒤집어 감사 가능한 조정 이력을 남긴다.
      const reversalLines = buildReversalJournalLines(
        originalJournalEntry.lines.map((line) => ({
          accountSubjectId: line.accountSubjectId,
          fundingAccountId: line.fundingAccountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          description: line.description
        }))
      );

      try {
        assertBalancedJournalAdjustmentLines(reversalLines);
      } catch (error) {
        throw validationError(readAdjustmentErrorMessage(error));
      }

      const claimedOriginalJournalEntryCount =
        await ctx.updateStatusInWorkspace(
          workspaceScope,
          originalJournalEntry.id,
          [originalJournalEntry.status],
          'REVERSED'
        );

      // 원전표 상태 갱신은 기대 상태를 조건으로 걸어 동시 조정 충돌을 감지한다.
      if (claimedOriginalJournalEntryCount !== 1) {
        const currentJournalEntryStatus =
          await ctx.findCurrentStatusInWorkspace(
            workspaceScope,
            journalEntryId
          );

        if (!currentJournalEntryStatus) {
          throw notFoundError('Journal entry not found.');
        }

        assertJournalEntryCanBeReversed(currentJournalEntryStatus);

        throw conflictError(
          'Journal entry changed during reversal. Please retry.'
        );
      }

      if (originalJournalEntry.sourceCollectedTransaction) {
        // 원전표가 수집 거래에서 나온 경우, 수집 거래도 정정 상태로 내려보내
        // 사용자가 이후 새 거래/전표로 다시 정리할 수 있게 한다.
        const claimedCollectedTransactionCount =
          await ctx.updateCollectedTransactionStatusInWorkspace(
            workspaceScope,
            originalJournalEntry.sourceCollectedTransaction.id,
            [originalJournalEntry.sourceCollectedTransaction.status],
            'CORRECTED'
          );

        if (claimedCollectedTransactionCount !== 1) {
          const currentCollectedTransactionStatus =
            await ctx.findCollectedTransactionStatusInWorkspace(
              workspaceScope,
              originalJournalEntry.sourceCollectedTransaction.id
            );

          if (!currentCollectedTransactionStatus) {
            throw notFoundError('Collected transaction not found.');
          }

          assertCollectedTransactionCanBeCorrected(
            currentCollectedTransactionStatus
          );

          throw conflictError(
            'Collected transaction changed during reversal. Please retry.'
          );
        }

        await ctx.restoreMatchedPlanningStateAfterReversal(
          workspaceScope,
          originalJournalEntry.sourceCollectedTransaction.id,
          originalJournalEntry.id
        );
      }

      return ctx.createAdjustmentEntry({
        workspace: workspaceScope,
        periodId: allocatedEntryNumber.period.id,
        entryNumber: buildJournalEntryEntryNumber(
          allocatedEntryNumber.period.year,
          allocatedEntryNumber.period.month,
          allocatedEntryNumber.sequence
        ),
        entryDate: buildJournalEntryDate(input.entryDate),
        sourceKind: 'MANUAL_ADJUSTMENT',
        status: 'POSTED',
        memo: reason ?? `Reversal of ${originalJournalEntry.entryNumber}`,
        reversesJournalEntryId: originalJournalEntry.id,
        actorRef: createdByActorRef,
        lines: reversalLines
      });
    });
  }
}

function readAdjustmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The journal adjustment is invalid.';
}
