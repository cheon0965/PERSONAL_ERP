import {
  BadRequestException,
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
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  normalizeJournalAdjustmentLines,
  normalizeOptionalText,
  type JournalAdjustmentLineDraft
} from './journal-entry-adjustment.policy';
import {
  assertJournalEntryCanBeCorrected
} from './journal-entry-transition.policy';
import {
  assertCollectedTransactionCanBeCorrected
} from '../collected-transactions/public';

const journalEntryItemInclude = {
  sourceCollectedTransaction: {
    select: {
      id: true,
      title: true,
      status: true
    }
  },
  lines: {
    include: {
      accountSubject: {
        select: {
          code: true,
          name: true
        }
      },
      fundingAccount: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      lineNumber: 'asc' as const
    }
  }
};

@Injectable()
export class CorrectJournalEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    journalEntryId: string,
    input: CorrectJournalEntryRequest
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(workspace.membershipRole, 'journal_entry.correct');

    const reason = normalizeOptionalText(input.reason);
    if (!reason) {
      throw new BadRequestException('Correction reason is required.');
    }

    const normalizedLines = normalizeJournalAdjustmentLines(input.lines);

    try {
      assertBalancedJournalAdjustmentLines(normalizedLines);
    } catch (error) {
      throw new BadRequestException(readAdjustmentErrorMessage(error));
    }

    const targetPeriod = await this.accountingPeriodsService.assertCollectingDateAllowed(
      user,
      input.entryDate
    );

    const originalJournalEntry = await this.prisma.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: journalEntryItemInclude
    });

    if (!originalJournalEntry) {
      throw new NotFoundException('Journal entry not found.');
    }

    assertJournalEntryCanBeCorrected(originalJournalEntry.status);

    await assertJournalAdjustmentReferencesExist(
      this.prisma,
      workspace.tenantId,
      workspace.ledgerId,
      normalizedLines
    );

    const createdJournalEntry = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.journalEntry.count({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: targetPeriod.id
        }
      });

      const created = await tx.journalEntry.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: targetPeriod.id,
          entryNumber: buildJournalEntryEntryNumber(
            targetPeriod.year,
            targetPeriod.month,
            existingCount + 1
          ),
          entryDate: buildJournalEntryDate(input.entryDate),
          sourceKind: JournalEntrySourceKind.MANUAL_ADJUSTMENT,
          status: JournalEntryStatus.POSTED,
          memo: reason,
          correctsJournalEntryId: originalJournalEntry.id,
          correctionReason: reason,
          ...createdByActorRef,
          lines: {
            create: normalizedLines
          }
        },
        include: journalEntryItemInclude
      });

      await tx.journalEntry.update({
        where: {
          id: originalJournalEntry.id
        },
        data: {
          status: JournalEntryStatus.SUPERSEDED
        }
      });

      if (originalJournalEntry.sourceCollectedTransaction) {
        assertCollectedTransactionCanBeCorrected(
          originalJournalEntry.sourceCollectedTransaction.status
        );

        await tx.collectedTransaction.update({
          where: {
            id: originalJournalEntry.sourceCollectedTransaction.id
          },
          data: {
            status: CollectedTransactionStatus.CORRECTED
          }
        });
      }

      return created;
    });

    return mapJournalEntryRecordToItem(createdJournalEntry);
  }
}

async function assertJournalAdjustmentReferencesExist(
  prisma: PrismaService,
  tenantId: string,
  ledgerId: string,
  lines: JournalAdjustmentLineDraft[]
): Promise<void> {
  const activeAccountSubjects = await prisma.accountSubject.findMany({
    where: {
      tenantId,
      ledgerId,
      isActive: true
    },
    select: {
      id: true
    }
  });

  const activeAccountSubjectIds = new Set(
    activeAccountSubjects.map((candidate) => candidate.id)
  );

  for (const line of lines) {
    if (!activeAccountSubjectIds.has(line.accountSubjectId)) {
      throw new BadRequestException(
        'One or more journal lines reference an unknown active account subject.'
      );
    }
  }

  const fundingAccountIds = [...new Set(
    lines
      .map((line) => line.fundingAccountId)
      .filter((value): value is string => Boolean(value))
  )];

  for (const fundingAccountId of fundingAccountIds) {
    const fundingAccount = await prisma.account.findFirst({
      where: {
        id: fundingAccountId,
        tenantId,
        ledgerId
      }
    });

    if (!fundingAccount) {
      throw new BadRequestException(
        'One or more journal lines reference an unknown funding account.'
      );
    }
  }
}

function readAdjustmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The journal adjustment is invalid.';
}
