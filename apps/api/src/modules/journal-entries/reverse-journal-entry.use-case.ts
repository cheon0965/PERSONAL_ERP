import {
  BadRequestException,
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
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
import {
  assertBalancedJournalAdjustmentLines,
  buildJournalEntryDate,
  buildJournalEntryEntryNumber,
  buildReversalJournalLines,
  normalizeOptionalText
} from './journal-entry-adjustment.policy';
import { assertJournalEntryCanBeReversed } from './journal-entry-transition.policy';
import { assertCollectedTransactionCanBeCorrected } from '../collected-transactions/public';

const journalEntryItemInclude = {
  sourceCollectedTransaction: {
    select: {
      id: true,
      title: true,
      status: true
    }
  },
  reversesJournalEntry: {
    select: {
      id: true,
      entryNumber: true
    }
  },
  reversedByJournalEntry: {
    select: {
      id: true,
      entryNumber: true
    }
  },
  correctsJournalEntry: {
    select: {
      id: true,
      entryNumber: true
    }
  },
  correctionEntries: {
    select: {
      id: true,
      entryNumber: true
    },
    orderBy: {
      createdAt: 'asc' as const
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
export class ReverseJournalEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    journalEntryId: string,
    input: ReverseJournalEntryRequest
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'journal_entry.reverse'
    );

    const targetPeriod =
      await this.accountingPeriodsService.assertCollectingDateAllowed(
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

    assertJournalEntryCanBeReversed(originalJournalEntry.status);

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

    const reason = normalizeOptionalText(input.reason);
    const memo = reason ?? `Reversal of ${originalJournalEntry.entryNumber}`;

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
          memo,
          reversesJournalEntryId: originalJournalEntry.id,
          ...createdByActorRef,
          lines: {
            create: reversalLines
          }
        },
        include: journalEntryItemInclude
      });

      await tx.journalEntry.update({
        where: {
          id: originalJournalEntry.id
        },
        data: {
          status: JournalEntryStatus.REVERSED
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

function readAdjustmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The journal adjustment is invalid.';
}
