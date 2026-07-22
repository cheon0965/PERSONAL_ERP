import { BadRequestException, Injectable } from '@nestjs/common';
import type { RecurrenceFrequency } from '@personal-erp/contracts';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../../../common/money/prisma-money';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { FundingAccountDirection, Prisma } from '@prisma/client';
import { assessPostingAccountSelection } from '../../../collected-transactions/public';
import type {
  CreateRecurringRuleRecord,
  StoredRecurringRule,
  StoredRecurringRuleDetail,
  UpdateRecurringRuleRecord
} from '../../application/ports/recurring-rule-store.port';
import { RecurringRuleStorePort } from '../../application/ports/recurring-rule-store.port';

type RecurringRuleListRecord = {
  id: string;
  title: string;
  amountWon: PrismaMoneyLike;
  frequency: RecurrenceFrequency;
  nextRunDate: Date | null;
  isActive: boolean;
  account: {
    name: string;
  };
  category: {
    name: string;
  } | null;
  linkedInsurancePolicy: {
    id: string;
  } | null;
  ledgerTransactionTypeId: string | null;
  fundingAccountDirection: FundingAccountDirection | null;
  counterpartyFundingAccountId: string | null;
  ledgerTransactionType: { name: string } | null;
  counterpartyFundingAccount: { name: string } | null;
};

type RecurringRuleDetailRecord = {
  id: string;
  title: string;
  accountId: string;
  ledgerTransactionTypeId: string | null;
  counterpartyFundingAccountId: string | null;
  fundingAccountDirection: FundingAccountDirection | null;
  categoryId: string | null;
  amountWon: PrismaMoneyLike;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  nextRunDate: Date | null;
  isActive: boolean;
  linkedInsurancePolicy: {
    id: string;
  } | null;
};

@Injectable()
export class PrismaRecurringRuleStoreAdapter implements RecurringRuleStorePort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllInWorkspace(
    tenantId: string,
    ledgerId: string
  ): Promise<StoredRecurringRule[]> {
    const items = await this.prisma.recurringRule.findMany({
      where: { tenantId, ledgerId },
      include: {
        account: {
          select: {
            name: true
          }
        },
        counterpartyFundingAccount: {
          select: {
            name: true
          }
        },
        ledgerTransactionType: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      },
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }]
    });

    return items.map(mapRecurringRuleListRecord);
  }

  async findByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<StoredRecurringRuleDetail | null> {
    const item = await this.prisma.recurringRule.findFirst({
      where: {
        id: recurringRuleId,
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        title: true,
        accountId: true,
        ledgerTransactionTypeId: true,
        counterpartyFundingAccountId: true,
        fundingAccountDirection: true,
        categoryId: true,
        amountWon: true,
        frequency: true,
        dayOfMonth: true,
        startDate: true,
        endDate: true,
        nextRunDate: true,
        isActive: true,
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return item ? mapRecurringRuleDetailRecord(item) : null;
  }

  async createInWorkspace(
    record: CreateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    const postingSetup = await resolveRecurringPostingSetup(
      this.prisma,
      record
    );
    const created = await this.prisma.recurringRule.create({
      data: {
        userId: record.userId,
        tenantId: record.tenantId,
        ledgerId: record.ledgerId,
        accountId: record.accountId,
        ledgerTransactionTypeId: postingSetup.ledgerTransactionTypeId,
        counterpartyFundingAccountId:
          record.counterpartyFundingAccountId ?? null,
        fundingAccountDirection: postingSetup.fundingAccountDirection,
        categoryId: record.categoryId,
        title: record.title,
        amountWon: record.amountWon,
        frequency: record.frequency,
        dayOfMonth: record.dayOfMonth,
        startDate: record.startDate,
        endDate: record.endDate,
        isActive: record.isActive,
        nextRunDate: record.nextRunDate
      },
      include: {
        account: {
          select: {
            name: true
          }
        },
        counterpartyFundingAccount: {
          select: { name: true }
        },
        ledgerTransactionType: {
          select: { name: true }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return mapRecurringRuleListRecord(created);
  }

  async updateInWorkspace(
    tenantId: string,
    ledgerId: string,
    record: UpdateRecurringRuleRecord
  ): Promise<StoredRecurringRule> {
    const postingSetup = await resolveRecurringPostingSetup(this.prisma, {
      ...record,
      tenantId,
      ledgerId
    });
    const updated = await this.prisma.recurringRule.update({
      where: { id: record.id },
      data: {
        accountId: record.accountId,
        ledgerTransactionTypeId: postingSetup.ledgerTransactionTypeId,
        counterpartyFundingAccountId:
          record.counterpartyFundingAccountId ?? null,
        fundingAccountDirection: postingSetup.fundingAccountDirection,
        categoryId: record.categoryId,
        title: record.title,
        amountWon: record.amountWon,
        frequency: record.frequency,
        dayOfMonth: record.dayOfMonth,
        startDate: record.startDate,
        endDate: record.endDate,
        isActive: record.isActive,
        nextRunDate: record.nextRunDate
      },
      include: {
        account: {
          select: {
            name: true
          }
        },
        counterpartyFundingAccount: {
          select: { name: true }
        },
        ledgerTransactionType: {
          select: { name: true }
        },
        category: {
          select: {
            name: true
          }
        },
        linkedInsurancePolicy: {
          select: {
            id: true
          }
        }
      }
    });

    return mapRecurringRuleListRecord(updated);
  }

  async deleteInWorkspace(
    tenantId: string,
    ledgerId: string,
    recurringRuleId: string
  ): Promise<boolean> {
    const result = await this.prisma.recurringRule.deleteMany({
      where: {
        id: recurringRuleId,
        tenantId,
        ledgerId
      }
    });

    return result.count > 0;
  }
}

function mapRecurringRuleListRecord(
  record: RecurringRuleListRecord
): StoredRecurringRule {
  return {
    id: record.id,
    title: record.title,
    amountWon: fromPrismaMoneyWon(record.amountWon),
    frequency: record.frequency,
    nextRunDate: record.nextRunDate,
    isActive: record.isActive,
    linkedInsurancePolicyId: record.linkedInsurancePolicy?.id ?? null,
    ledgerTransactionTypeId: record.ledgerTransactionTypeId,
    ledgerTransactionTypeName: record.ledgerTransactionType?.name ?? null,
    fundingAccountDirection: record.fundingAccountDirection,
    counterpartyFundingAccountId: record.counterpartyFundingAccountId,
    account: {
      name: record.account.name
    },
    counterpartyAccount: record.counterpartyFundingAccount,
    category: record.category
      ? {
          name: record.category.name
        }
      : null
  };
}

function mapRecurringRuleDetailRecord(
  record: RecurringRuleDetailRecord
): StoredRecurringRuleDetail {
  return {
    id: record.id,
    title: record.title,
    accountId: record.accountId,
    ledgerTransactionTypeId: record.ledgerTransactionTypeId,
    counterpartyFundingAccountId: record.counterpartyFundingAccountId,
    fundingAccountDirection: record.fundingAccountDirection,
    categoryId: record.categoryId,
    amountWon: fromPrismaMoneyWon(record.amountWon),
    frequency: record.frequency,
    dayOfMonth: record.dayOfMonth,
    startDate: record.startDate,
    endDate: record.endDate,
    nextRunDate: record.nextRunDate,
    isActive: record.isActive,
    linkedInsurancePolicyId: record.linkedInsurancePolicy?.id ?? null
  };
}

async function resolveRecurringPostingSetup(
  client: Pick<
    Prisma.TransactionClient,
    'account' | 'category' | 'ledgerTransactionType'
  >,
  record: {
    tenantId: string;
    ledgerId: string;
    accountId: string;
    categoryId?: string;
    ledgerTransactionTypeId?: string;
    counterpartyFundingAccountId?: string;
    fundingAccountDirection?: import('@personal-erp/contracts').FundingAccountDirection;
  }
) {
  const [accounts, category] = await Promise.all([
    client.account.findMany({
      where: {
        tenantId: record.tenantId,
        ledgerId: record.ledgerId,
        id: {
          in: [
            record.accountId,
            ...(record.counterpartyFundingAccountId
              ? [record.counterpartyFundingAccountId]
              : [])
          ]
        }
      },
      select: { id: true, type: true }
    }),
    record.categoryId
      ? client.category.findFirst({
          where: {
            id: record.categoryId,
            tenantId: record.tenantId,
            ledgerId: record.ledgerId
          },
          select: { id: true, kind: true }
        })
      : Promise.resolve(null)
  ]);
  const primary = accounts.find((item) => item.id === record.accountId);
  const counterparty = record.counterpartyFundingAccountId
    ? accounts.find((item) => item.id === record.counterpartyFundingAccountId)
    : null;
  if (!primary || (record.counterpartyFundingAccountId && !counterparty)) {
    throw new BadRequestException(
      '현재 Ledger에서 선택한 반복 자금수단을 찾을 수 없습니다.'
    );
  }

  const inferredCode = record.ledgerTransactionTypeId
    ? null
    : inferRecurringTransactionTypeCode({
        primaryType: primary.type,
        counterpartyType: counterparty?.type ?? null,
        categoryKind: category?.kind ?? null
      });
  const ledgerTransactionType =
    record.ledgerTransactionTypeId || inferredCode
      ? await client.ledgerTransactionType.findFirst({
          where: {
            tenantId: record.tenantId,
            ledgerId: record.ledgerId,
            ...(record.ledgerTransactionTypeId
              ? { id: record.ledgerTransactionTypeId }
              : { code: inferredCode ?? undefined }),
            isActive: true
          },
          select: { id: true, postingPolicyKey: true }
        })
      : null;

  if (record.ledgerTransactionTypeId && !ledgerTransactionType) {
    throw new BadRequestException(
      '현재 Ledger에서 활성 거래유형을 찾을 수 없습니다.'
    );
  }
  if (!ledgerTransactionType) {
    return {
      ledgerTransactionTypeId: null,
      fundingAccountDirection:
        record.fundingAccountDirection == null
          ? null
          : FundingAccountDirection[record.fundingAccountDirection]
    };
  }

  const assessment = assessPostingAccountSelection({
    postingPolicyKey: ledgerTransactionType.postingPolicyKey,
    fundingAccountId: primary.id,
    fundingAccountType: primary.type,
    counterpartyFundingAccountId: counterparty?.id ?? null,
    counterpartyFundingAccountType: counterparty?.type ?? null,
    fundingAccountDirection: record.fundingAccountDirection,
    categoryId: category?.id ?? null
  });
  if (assessment.validationError) {
    throw new BadRequestException(assessment.validationError);
  }

  return {
    ledgerTransactionTypeId: ledgerTransactionType.id,
    fundingAccountDirection: assessment.direction
      ? FundingAccountDirection[assessment.direction]
      : null
  };
}

function inferRecurringTransactionTypeCode(input: {
  primaryType: 'BANK' | 'CASH' | 'CARD';
  counterpartyType: 'BANK' | 'CASH' | 'CARD' | null;
  categoryKind: 'INCOME' | 'EXPENSE' | 'TRANSFER' | null;
}) {
  if (input.categoryKind === 'INCOME') {
    return 'INCOME_BASIC';
  }
  if (input.categoryKind === 'EXPENSE') {
    return input.primaryType === 'CARD' ? 'CARD_SPEND' : 'EXPENSE_BASIC';
  }
  if (input.categoryKind === 'TRANSFER') {
    return 'TRANSFER_BASIC';
  }
  if (
    (input.primaryType === 'CARD' &&
      input.counterpartyType != null &&
      input.counterpartyType !== 'CARD') ||
    (input.primaryType !== 'CARD' && input.counterpartyType === 'CARD')
  ) {
    return 'CARD_PAYMENT';
  }
  if (input.primaryType !== 'CARD' && input.counterpartyType !== 'CARD') {
    return input.counterpartyType ? 'TRANSFER_BASIC' : null;
  }
  return null;
}
