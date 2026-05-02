import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CorrectJournalEntryRequest,
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
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import { assertCollectedTransactionCanBeCorrected } from '../collected-transactions/collected-transaction-transition.policy';
import { JournalEntryAdjustmentStorePort } from './application/ports/journal-entry-adjustment-store.port';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  normalizeJournalAdjustmentLines,
  normalizeOptionalText
} from './journal-entry-adjustment.policy';
import { assertJournalEntryCanBeCorrected } from './journal-entry-transition.policy';

/**
 * 기존 전표를 덮어쓰지 않고 새 정정 전표로 대체하는 유스케이스입니다.
 *
 * 정정은 사용자가 새 분개 라인을 직접 제시하는 흐름이므로, 라인 정규화와 대차 검증을 먼저 끝낸 뒤
 * 원전표를 SUPERSEDED로 선점합니다. 이렇게 해야 원본 판단, 정정 사유, 새 전표가 모두 감사 가능한 이력으로 남습니다.
 */
@Injectable()
export class CorrectJournalEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort,
    private readonly journalEntryAdjustmentStore: JournalEntryAdjustmentStorePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    journalEntryId: string,
    input: CorrectJournalEntryRequest
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const workspaceScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'journal_entry.correct'
    );

    const reason = normalizeOptionalText(input.reason);
    if (!reason) {
      throw new BadRequestException('Correction reason is required.');
    }

    // 정정 전표는 사용자가 직접 라인을 입력하므로 먼저 정규화와 대차 검증을 끝낸다.
    // 이 검증을 통과한 라인만 DB 참조 존재 여부와 원전표 상태 갱신 단계로 보낸다.
    const normalizedLines = normalizeJournalAdjustmentLines(input.lines);

    try {
      assertBalancedJournalAdjustmentLines(normalizedLines);
    } catch (error) {
      throw new BadRequestException(readAdjustmentErrorMessage(error));
    }

    const targetPeriod =
      await this.accountingPeriodWriteGuard.assertJournalEntryDateAllowed(
        workspaceScope,
        input.entryDate
      );

    const createdJournalEntry = await this.prisma.$transaction(async (tx) => {
      // 원전표를 SUPERSEDED로 선점한 뒤 새 POSTED 전표를 만든다.
      // 원본을 덮어쓰지 않기 때문에 이전 판단과 새 판단을 모두 추적할 수 있다.
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

      assertJournalEntryCanBeCorrected(originalJournalEntry.status);

      await this.journalEntryAdjustmentStore.assertAdjustmentReferencesExist(
        tx,
        workspaceScope,
        normalizedLines
      );

      // 원전표 상태가 읽은 시점과 달라졌다면 다른 조정이 먼저 들어온 것이므로 재시도를 요구한다.
      const claimedOriginalJournalEntryCount =
        await this.journalEntryAdjustmentStore.updateStatusInWorkspace(
          tx,
          workspaceScope,
          originalJournalEntry.id,
          [originalJournalEntry.status],
          JournalEntryStatus.SUPERSEDED
        );

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

        assertJournalEntryCanBeCorrected(currentJournalEntryStatus);

        throw new ConflictException(
          'Journal entry changed during correction. Please retry.'
        );
      }

      if (originalJournalEntry.sourceCollectedTransaction) {
        // 수집 거래에서 출발한 전표를 정정하면 원수집거래도 더 이상 확정 원천으로 보지 않는다.
        // 이후 사용자는 새 수집 거래 또는 정정 전표 이력으로 차이를 추적한다.
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
            'Collected transaction changed during correction. Please retry.'
          );
        }
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
        memo: reason,
        correctsJournalEntryId: originalJournalEntry.id,
        correctionReason: reason,
        actorRef: createdByActorRef,
        lines: normalizedLines
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
