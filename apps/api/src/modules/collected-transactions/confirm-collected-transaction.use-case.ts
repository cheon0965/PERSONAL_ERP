import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  JournalEntryItem
} from '@personal-erp/contracts';
import {
  AuditActorType,
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus,
  PlanItemStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapJournalEntryRecordToItem } from '../journal-entries/journal-entry-item.mapper';
import {
  buildConfirmCollectedTransactionEntryNumber,
  REQUIRED_CONFIRM_ACCOUNT_SUBJECT_CODES,
  resolveConfirmCollectedTransactionJournalLines,
  resolveConfirmJournalAccountSubjectIds
} from './confirm-collected-transaction.policy';

@Injectable()
export class ConfirmCollectedTransactionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    collectedTransactionId: string
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);

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

    if (period.status === 'LOCKED') {
      throw new BadRequestException(
        'Collected transaction in a locked period cannot be confirmed.'
      );
    }

    if (collectedTransaction.postedJournalEntry) {
      throw new ConflictException('Collected transaction is already posted.');
    }

    if (
      collectedTransaction.status === CollectedTransactionStatus.POSTED ||
      collectedTransaction.status === CollectedTransactionStatus.CORRECTED ||
      collectedTransaction.status === CollectedTransactionStatus.LOCKED
    ) {
      throw new ConflictException(
        'Collected transaction in current status cannot be confirmed.'
      );
    }

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

    const accountSubjectIds =
      resolveConfirmJournalAccountSubjectIds(accountSubjects);

    if (!accountSubjectIds) {
      throw new InternalServerErrorException(
        'Required account subjects are missing in this ledger.'
      );
    }

    const journalLines = resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey:
        collectedTransaction.ledgerTransactionType.postingPolicyKey,
      amount: collectedTransaction.amount,
      title: collectedTransaction.title,
      fundingAccountId: collectedTransaction.fundingAccount.id,
      accountSubjectIds
    });

    if (journalLines.kind === 'requires_counterparty_account') {
      throw new BadRequestException(
        'This posting policy requires a second account selection.'
      );
    }

    if (journalLines.kind === 'unsupported_policy') {
      throw new BadRequestException(
        'This posting policy is not supported for collected transaction confirmation.'
      );
    }

    const journalEntry = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.journalEntry.count({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id
        }
      });

      const entryNumber = buildConfirmCollectedTransactionEntryNumber(
        period.year,
        period.month,
        existingCount + 1
      );

      const created = await tx.journalEntry.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          entryNumber,
          entryDate: collectedTransaction.occurredOn,
          sourceKind: JournalEntrySourceKind.COLLECTED_TRANSACTION,
          sourceCollectedTransactionId: collectedTransaction.id,
          status: JournalEntryStatus.POSTED,
          memo: collectedTransaction.memo ?? collectedTransaction.title,
          createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
          createdByMembershipId: workspace.membershipId,
          lines: {
            create: journalLines.lines
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
          id: collectedTransaction.id
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
