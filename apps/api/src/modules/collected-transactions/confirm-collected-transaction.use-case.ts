import {
  BadRequestException,
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
  JournalEntryStatus,
  PlanItemStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readWorkspaceCreatedByActorRef } from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapJournalEntryRecordToItem } from '../journal-entries/journal-entry-item.mapper';
import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  buildConfirmCollectedTransactionEntryNumber,
  REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES,
  resolveConfirmJournalAccountSubjectIds,
  resolveConfirmCollectedTransactionJournalLines
} from './confirm-collected-transaction.policy';
import { assertCollectedTransactionCanBeConfirmed } from './collected-transaction-transition.policy';

@Injectable()
export class ConfirmCollectedTransactionUseCase {
  constructor(private readonly prisma: PrismaService) {}

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

    const collectedTransaction =
      await this.prisma.collectedTransaction.findFirst({
        where: {
          id: collectedTransactionId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
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
          postedJournalEntry: {
            select: {
              id: true
            }
          }
        }
      });

    if (!collectedTransaction) {
      throw new NotFoundException('Collected transaction not found.');
    }

    if (!collectedTransaction.period) {
      throw new BadRequestException(
        'Collected transaction is not linked to an accounting period.'
      );
    }

    const period = collectedTransaction.period;
    assertCollectedTransactionCanBeConfirmed({
      status: collectedTransaction.status,
      periodStatus: period.status,
      postedJournalEntryId: collectedTransaction.postedJournalEntry?.id ?? null
    });

    const accountSubjects = await this.prisma.accountSubject.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        code: {
          in: [...REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES]
        },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });

    const accountSubjectIds = assertConfirmJournalAccountSubjectIdsResolved(
      resolveConfirmJournalAccountSubjectIds(accountSubjects)
    );

    const journalEntry = await this.prisma.$transaction(async (tx) => {
      const latestCollectedTransaction =
        await tx.collectedTransaction.findFirst({
          where: {
            id: collectedTransaction.id,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
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
            fundingAccount: {
              select: {
                id: true
              }
            },
            ledgerTransactionType: {
              select: {
                postingPolicyKey: true
              }
            },
            postedJournalEntry: {
              select: {
                id: true
              }
            }
          }
        });

      if (!latestCollectedTransaction) {
        throw new NotFoundException('Collected transaction not found.');
      }

      if (!latestCollectedTransaction.period) {
        throw new BadRequestException(
          'Collected transaction is not linked to an accounting period.'
        );
      }

      const latestPeriod = latestCollectedTransaction.period;
      assertCollectedTransactionCanBeConfirmed({
        status: latestCollectedTransaction.status,
        periodStatus: latestPeriod.status,
        postedJournalEntryId:
          latestCollectedTransaction.postedJournalEntry?.id ?? null
      });

      const journalLines = assertConfirmJournalLinesSupported(
        resolveConfirmCollectedTransactionJournalLines({
          postingPolicyKey:
            latestCollectedTransaction.ledgerTransactionType.postingPolicyKey,
          amount: latestCollectedTransaction.amount,
          title: latestCollectedTransaction.title,
          fundingAccountId: latestCollectedTransaction.fundingAccount.id,
          accountSubjectIds
        })
      );

      const existingCount = await tx.journalEntry.count({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: latestPeriod.id
        }
      });

      const entryNumber = buildConfirmCollectedTransactionEntryNumber(
        latestPeriod.year,
        latestPeriod.month,
        existingCount + 1
      );

      const created = await tx.journalEntry.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: latestPeriod.id,
          entryNumber,
          entryDate: latestCollectedTransaction.occurredOn,
          sourceKind: JournalEntrySourceKind.COLLECTED_TRANSACTION,
          sourceCollectedTransactionId: latestCollectedTransaction.id,
          status: JournalEntryStatus.POSTED,
          memo:
            latestCollectedTransaction.memo ?? latestCollectedTransaction.title,
          ...createdByActorRef,
          lines: {
            create: journalLines
          }
        },
        include: {
          sourceCollectedTransaction: {
            select: {
              id: true,
              title: true
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
              lineNumber: 'asc'
            }
          }
        }
      });

      await tx.collectedTransaction.update({
        where: {
          id: latestCollectedTransaction.id
        },
        data: {
          status: CollectedTransactionStatus.POSTED
        }
      });

      if (collectedTransaction.matchedPlanItemId) {
        await tx.planItem.update({
          where: {
            id: collectedTransaction.matchedPlanItemId
          },
          data: {
            status: PlanItemStatus.CONFIRMED
          }
        });
      }

      return created;
    });

    return mapJournalEntryRecordToItem(journalEntry);
  }
}
