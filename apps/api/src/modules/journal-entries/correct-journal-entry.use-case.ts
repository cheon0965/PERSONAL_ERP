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
  JournalEntryStatus,
  Prisma
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
import { assertJournalEntryCanBeCorrected } from './journal-entry-transition.policy';
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
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'journal_entry.correct'
    );

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

    const targetPeriod =
      await this.accountingPeriodsService.assertCollectingDateAllowed(
        user,
        input.entryDate
      );

    const createdJournalEntry = await this.prisma.$transaction(async (tx) => {
      const allocatedEntryNumber =
        await this.accountingPeriodsService.allocateJournalEntryNumberInTransaction(
          tx,
          workspace.tenantId,
          workspace.ledgerId,
          targetPeriod.id
        );

      const originalJournalEntry = await tx.journalEntry.findFirst({
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
        tx,
        workspace.tenantId,
        workspace.ledgerId,
        normalizedLines
      );

      const claimedOriginalJournalEntry = await tx.journalEntry.updateMany({
        where: {
          id: originalJournalEntry.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [originalJournalEntry.status]
          }
        },
        data: {
          status: JournalEntryStatus.SUPERSEDED
        }
      });

      if (claimedOriginalJournalEntry.count !== 1) {
        const currentJournalEntry = await tx.journalEntry.findFirst({
          where: {
            id: journalEntryId,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          }
        });

        if (!currentJournalEntry) {
          throw new NotFoundException('Journal entry not found.');
        }

        assertJournalEntryCanBeCorrected(currentJournalEntry.status);

        throw new ConflictException(
          'Journal entry changed during correction. Please retry.'
        );
      }

      if (originalJournalEntry.sourceCollectedTransaction) {
        const claimedCollectedTransaction =
          await tx.collectedTransaction.updateMany({
            where: {
              id: originalJournalEntry.sourceCollectedTransaction.id,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              status: {
                in: [originalJournalEntry.sourceCollectedTransaction.status]
              }
            },
            data: {
              status: CollectedTransactionStatus.CORRECTED
            }
          });

        if (claimedCollectedTransaction.count !== 1) {
          const currentCollectedTransaction =
            await tx.collectedTransaction.findFirst({
              where: {
                id: originalJournalEntry.sourceCollectedTransaction.id,
                tenantId: workspace.tenantId,
                ledgerId: workspace.ledgerId
              },
              select: {
                status: true
              }
            });

          if (!currentCollectedTransaction) {
            throw new NotFoundException('Collected transaction not found.');
          }

          assertCollectedTransactionCanBeCorrected(
            currentCollectedTransaction.status
          );

          throw new ConflictException(
            'Collected transaction changed during correction. Please retry.'
          );
        }
      }

      const created = await tx.journalEntry.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
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
          ...createdByActorRef,
          lines: {
            create: normalizedLines
          }
        },
        include: journalEntryItemInclude
      });

      return created;
    });

    return mapJournalEntryRecordToItem(createdJournalEntry);
  }
}

async function assertJournalAdjustmentReferencesExist(
  prisma: PrismaService | Prisma.TransactionClient,
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

  const fundingAccountIds = [
    ...new Set(
      lines
        .map((line) => line.fundingAccountId)
        .filter((value): value is string => Boolean(value))
    )
  ];

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
