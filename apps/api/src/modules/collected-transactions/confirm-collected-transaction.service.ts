import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type { JournalEntryItem } from '@personal-erp/contracts';
import {
  AuditActorType,
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus,
  PostingPolicyKey,
  PlanItemStatus
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapJournalEntryRecordToItem } from '../journal-entries/journal-entry-item.mapper';

type ConfirmCollectedTransactionCommand = {
  collectedTransactionId: string;
  tenantId: string;
  ledgerId: string;
  membershipId: string;
};

const ASSET_SUBJECT_CODE = '1010';
const LIABILITY_SUBJECT_CODE = '2010'; // 미지급금(카드대금)
const INCOME_SUBJECT_CODE = '4100';
const EXPENSE_SUBJECT_CODE = '5100';

@Injectable()
export class ConfirmCollectedTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: ConfirmCollectedTransactionCommand
  ): Promise<JournalEntryItem> {
    const collectedTransaction =
      await this.prisma.collectedTransaction.findFirst({
        where: {
          id: command.collectedTransactionId,
          tenantId: command.tenantId,
          ledgerId: command.ledgerId
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
          category: {
            select: {
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
              id: true
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
      throw new NotFoundException('?섏쭛 嫄곕옒瑜?李얠쓣 ???놁뒿?덈떎.');
    }

    if (!collectedTransaction.period) {
      throw new BadRequestException(
        '?댁쁺 湲곌컙???랁븯吏 ?딆? ?섏쭛 嫄곕옒???꾪몴濡??뺤젙?????놁뒿?덈떎.'
      );
    }

    if (collectedTransaction.period.status === 'LOCKED') {
      throw new BadRequestException(
        '?좉툑???댁쁺 湲곌컙???섏쭛 嫄곕옒???꾪몴濡??뺤젙?????놁뒿?덈떎.'
      );
    }

    if (collectedTransaction.postedJournalEntry) {
      throw new ConflictException('?대? ?꾪몴濡??뺤젙???섏쭛 嫄곕옒?낅땲??');
    }

    if (
      collectedTransaction.status === CollectedTransactionStatus.POSTED ||
      collectedTransaction.status === CollectedTransactionStatus.CORRECTED ||
      collectedTransaction.status === CollectedTransactionStatus.LOCKED
    ) {
      throw new ConflictException(
        '?꾩옱 ?곹깭???섏쭛 嫄곕옒???꾪몴濡??뺤젙?????놁뒿?덈떎.'
      );
    }

    const accountSubjects = await this.prisma.accountSubject.findMany({
      where: {
        tenantId: command.tenantId,
        ledgerId: command.ledgerId,
        code: {
          in: [
            ASSET_SUBJECT_CODE,
            LIABILITY_SUBJECT_CODE,
            INCOME_SUBJECT_CODE,
            EXPENSE_SUBJECT_CODE
          ]
        },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });

    const accountSubjectByCode = new Map(
      accountSubjects.map((subject) => [subject.code, subject.id])
    );

    const assetSubjectId = accountSubjectByCode.get(ASSET_SUBJECT_CODE);
    const liabilitySubjectId = accountSubjectByCode.get(LIABILITY_SUBJECT_CODE);
    const incomeSubjectId = accountSubjectByCode.get(INCOME_SUBJECT_CODE);
    const expenseSubjectId = accountSubjectByCode.get(EXPENSE_SUBJECT_CODE);

    if (
      !assetSubjectId ||
      !liabilitySubjectId ||
      !incomeSubjectId ||
      !expenseSubjectId
    ) {
      throw new InternalServerErrorException(
        '현재 Ledger의 기본 계정과목 마스터가 준비되어 있지 않습니다.'
      );
    }

    const journalEntry = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.journalEntry.count({
        where: {
          tenantId: command.tenantId,
          ledgerId: command.ledgerId,
          periodId: collectedTransaction.period!.id
        }
      });

      const entryNumber = buildEntryNumber(
        collectedTransaction.period!.year,
        collectedTransaction.period!.month,
        existingCount + 1
      );

      const journalLines = buildJournalLines({
        postingPolicyKey: collectedTransaction.ledgerTransactionType.postingPolicyKey,
        amount: collectedTransaction.amount,
        title: collectedTransaction.title,
        fundingAccountId: collectedTransaction.fundingAccount.id,
        assetSubjectId,
        liabilitySubjectId,
        incomeSubjectId,
        expenseSubjectId
      });

      const created = await tx.journalEntry.create({
        data: {
          tenantId: command.tenantId,
          ledgerId: command.ledgerId,
          periodId: collectedTransaction.period!.id,
          entryNumber,
          entryDate: collectedTransaction.occurredOn,
          sourceKind: JournalEntrySourceKind.COLLECTED_TRANSACTION,
          sourceCollectedTransactionId: collectedTransaction.id,
          status: JournalEntryStatus.POSTED,
          memo: collectedTransaction.memo ?? collectedTransaction.title,
          createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
          createdByMembershipId: command.membershipId,
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

function buildEntryNumber(year: number, month: number, sequence: number): string {
  return `${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(
    4,
    '0'
  )}`;
}

function buildJournalLines(input: {
  postingPolicyKey: PostingPolicyKey;
  amount: number;
  title: string;
  fundingAccountId: string;
  assetSubjectId: string;
  liabilitySubjectId: string;
  incomeSubjectId: string;
  expenseSubjectId: string;
}) {
  switch (input.postingPolicyKey) {
    case PostingPolicyKey.INCOME_BASIC:
      return [
        {
          lineNumber: 1,
          accountSubjectId: input.assetSubjectId,
          fundingAccountId: input.fundingAccountId,
          debitAmount: input.amount,
          creditAmount: 0,
          description: input.title
        },
        {
          lineNumber: 2,
          accountSubjectId: input.incomeSubjectId,
          debitAmount: 0,
          creditAmount: input.amount,
          description: input.title
        }
      ];
    case PostingPolicyKey.EXPENSE_BASIC:
      return [
        {
          lineNumber: 1,
          accountSubjectId: input.expenseSubjectId,
          debitAmount: input.amount,
          creditAmount: 0,
          description: input.title
        },
        {
          lineNumber: 2,
          accountSubjectId: input.assetSubjectId,
          fundingAccountId: input.fundingAccountId,
          debitAmount: 0,
          creditAmount: input.amount,
          description: input.title
        }
      ];
    case PostingPolicyKey.CARD_SPEND:
      return [
        {
          lineNumber: 1,
          accountSubjectId: input.expenseSubjectId,
          debitAmount: input.amount,
          creditAmount: 0,
          description: input.title
        },
        {
          lineNumber: 2,
          accountSubjectId: input.liabilitySubjectId,
          fundingAccountId: input.fundingAccountId,
          debitAmount: 0,
          creditAmount: input.amount,
          description: input.title
        }
      ];
    case PostingPolicyKey.TRANSFER_BASIC:
    case PostingPolicyKey.CARD_PAYMENT:
      throw new BadRequestException(
        '기본 이체 및 카드 대금 납부(2개 이상의 자금수단 매핑 필요) 거래는 현재 버전에서 수동 분개가 필요합니다.'
      );
    default:
      throw new BadRequestException(
        '?꾩옱 ?④퀎?먯꽌??湲곕낯 ?섏엯/吏異??섏쭛 嫄곕옒留??꾪몴濡??뺤젙?????덉뒿?덈떎.'
      );
  }
}
