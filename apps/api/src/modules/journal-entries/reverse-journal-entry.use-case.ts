import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  JournalEntryItem,
  ReverseJournalEntryRequest
} from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import { assertCollectedTransactionCanBeCorrected } from '../collected-transactions/collected-transaction-transition.policy';
import { JournalEntryAdjustmentStorePort } from './application/ports/journal-entry-adjustment-store.port';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  buildReversalJournalLines,
  normalizeOptionalText
} from './journal-entry-adjustment.policy';
import { assertJournalEntryCanBeReversed } from './journal-entry-transition.policy';

/**
 * 게시된 전표를 삭제하지 않고 반대 분개 전표로 되돌리는 유스케이스입니다.
 *
 * 회계 이력은 원장을 직접 수정하지 않는 것이 중요하므로 원전표는 REVERSED로 표시하고,
 * 차변/대변을 뒤집은 새 POSTED 전표를 생성합니다. 수집 거래에서 출발한 전표라면 원수집거래도 CORRECTED로 내려
 * 운영 화면과 회계 장부의 상태가 함께 움직이게 합니다.
 */
@Injectable()
export class ReverseJournalEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
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

    const createdJournalEntry = await this.prisma.$transaction(async (tx) => {
      // 반전 전표도 일반 전표와 같은 기간별 순번을 사용한다.
      // 대상 기간 쓰기 가능 여부는 트랜잭션 밖에서 확인하고, 번호 할당은 트랜잭션 안에서 확정한다.
      const allocatedEntryNumber =
        await this.accountingPeriodWriteGuard.allocateJournalEntryNumberInTransaction(
          tx,
          workspaceScope,
          targetPeriod.id
        );

      const originalJournalEntry =
        await this.journalEntryAdjustmentStore.findByIdInWorkspace(
          tx,
          workspaceScope,
          journalEntryId
        );

      if (!originalJournalEntry) {
        throw new NotFoundException('Journal entry not found.');
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
        throw new BadRequestException(readAdjustmentErrorMessage(error));
      }

      const claimedOriginalJournalEntryCount =
        await this.journalEntryAdjustmentStore.updateStatusInWorkspace(
          tx,
          workspaceScope,
          originalJournalEntry.id,
          [originalJournalEntry.status],
          JournalEntryStatus.REVERSED
        );

      // 원전표 상태 갱신은 기대 상태를 조건으로 걸어 동시 조정 충돌을 감지한다.
      if (claimedOriginalJournalEntryCount !== 1) {
        const currentJournalEntryStatus =
          await this.journalEntryAdjustmentStore.findCurrentStatusInWorkspace(
            tx,
            workspaceScope,
            journalEntryId
          );

        if (!currentJournalEntryStatus) {
          throw new NotFoundException('Journal entry not found.');
        }

        assertJournalEntryCanBeReversed(currentJournalEntryStatus);

        throw new ConflictException(
          'Journal entry changed during reversal. Please retry.'
        );
      }

      if (originalJournalEntry.sourceCollectedTransaction) {
        // 원전표가 수집 거래에서 나온 경우, 수집 거래도 정정 상태로 내려보내
        // 사용자가 이후 새 거래/전표로 다시 정리할 수 있게 한다.
        const claimedCollectedTransactionCount =
          await this.journalEntryAdjustmentStore.updateCollectedTransactionStatusInWorkspace(
            tx,
            workspaceScope,
            originalJournalEntry.sourceCollectedTransaction.id,
            [originalJournalEntry.sourceCollectedTransaction.status],
            CollectedTransactionStatus.CORRECTED
          );

        if (claimedCollectedTransactionCount !== 1) {
          const currentCollectedTransactionStatus =
            await this.journalEntryAdjustmentStore.findCollectedTransactionStatusInWorkspace(
              tx,
              workspaceScope,
              originalJournalEntry.sourceCollectedTransaction.id
            );

          if (!currentCollectedTransactionStatus) {
            throw new NotFoundException('Collected transaction not found.');
          }

          assertCollectedTransactionCanBeCorrected(
            currentCollectedTransactionStatus
          );

          throw new ConflictException(
            'Collected transaction changed during reversal. Please retry.'
          );
        }

        await this.journalEntryAdjustmentStore.restoreMatchedPlanningStateAfterReversal(
          tx,
          workspaceScope,
          originalJournalEntry.sourceCollectedTransaction.id,
          originalJournalEntry.id
        );
      }

      return this.journalEntryAdjustmentStore.createAdjustmentEntry(tx, {
        workspace: workspaceScope,
        periodId: allocatedEntryNumber.period.id,
        entryNumber: buildJournalEntryEntryNumber(
          allocatedEntryNumber.period.year,
          allocatedEntryNumber.period.month,
          allocatedEntryNumber.sequence
        ),
        entryDate: buildJournalEntryDate(input.entryDate),
        sourceKind: JournalEntrySourceKind.MANUAL_ADJUSTMENT,
        status: JournalEntryStatus.POSTED,
        memo: reason ?? `Reversal of ${originalJournalEntry.entryNumber}`,
        reversesJournalEntryId: originalJournalEntry.id,
        actorRef: createdByActorRef,
        lines: reversalLines
      });
    });

    return mapJournalEntryRecordToItem(createdJournalEntry);
  }
}

function readAdjustmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The journal adjustment is invalid.';
}
