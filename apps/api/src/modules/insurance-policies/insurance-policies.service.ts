import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateInsurancePolicyRequest,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { CategoryKind, type Prisma, RecurrenceFrequency } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import {
  prepareRecurringRuleSchedule,
  resolveMissingOwnedRecurringRuleReference
} from '../recurring-rules/public';
import { mapInsurancePolicyToItem } from './insurance-policies.mapper';
import { InsurancePoliciesRepository } from './insurance-policies.repository';

const insurancePolicyInclude = {
  account: {
    select: {
      id: true,
      name: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

type NormalizedInsurancePolicyInput = {
  provider: string;
  productName: string;
  monthlyPremiumWon: number;
  paymentDay: number;
  cycle: CreateInsurancePolicyRequest['cycle'];
  fundingAccountId: string;
  categoryId: string;
  recurringStartDate: string;
  renewalDate: string | null;
  maturityDate: string | null;
  isActive: boolean;
};

@Injectable()
export class InsurancePoliciesService {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository,
    private readonly prisma: PrismaService
  ) {}

  async findAll(
    user: AuthenticatedUser,
    input?: {
      includeInactive?: boolean;
    }
  ): Promise<InsurancePolicyItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const items = await this.insurancePoliciesRepository.findAllInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      input
    );

    return items.map(mapInsurancePolicyToItem);
  }

  async create(
    user: AuthenticatedUser,
    input: CreateInsurancePolicyRequest
  ): Promise<InsurancePolicyItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalizedInput = normalizeInsurancePolicyInput(input);

    await this.assertNoDuplicateInsurancePolicy({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      provider: normalizedInput.provider,
      productName: normalizedInput.productName
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertRecurringReferences(tx, {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        fundingAccountId: normalizedInput.fundingAccountId,
        categoryId: normalizedInput.categoryId
      });

      const linkedRecurringRuleId = await this.syncLinkedRecurringRule(tx, {
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        input: normalizedInput
      });

        return tx.insurancePolicy.create({
          data: {
            userId: workspace.userId,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            accountId: normalizedInput.fundingAccountId,
            categoryId: normalizedInput.categoryId,
            recurringStartDate: normalizedInput.recurringStartDate,
            linkedRecurringRuleId,
            provider: normalizedInput.provider,
            normalizedProvider: normalizeCaseInsensitiveText(
              normalizedInput.provider
            ),
            productName: normalizedInput.productName,
            normalizedProductName: normalizeCaseInsensitiveText(
              normalizedInput.productName
            ),
            monthlyPremiumWon: normalizedInput.monthlyPremiumWon,
            paymentDay: normalizedInput.paymentDay,
            cycle: normalizedInput.cycle,
          renewalDate: normalizedInput.renewalDate,
          maturityDate: normalizedInput.maturityDate,
          isActive: normalizedInput.isActive
        },
        include: insurancePolicyInclude
      });
    });

    return mapInsurancePolicyToItem(created);
  }

  async update(
    user: AuthenticatedUser,
    insurancePolicyId: string,
    input: UpdateInsurancePolicyRequest
  ): Promise<InsurancePolicyItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePoliciesRepository.findByIdInWorkspace(
      insurancePolicyId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    const normalizedInput = normalizeInsurancePolicyInput(input);

    await this.assertNoDuplicateInsurancePolicy({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      provider: normalizedInput.provider,
      productName: normalizedInput.productName,
      excludeInsurancePolicyId: existing.id
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertRecurringReferences(tx, {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        fundingAccountId: normalizedInput.fundingAccountId,
        categoryId: normalizedInput.categoryId
      });

      const linkedRecurringRuleId = await this.syncLinkedRecurringRule(tx, {
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        input: normalizedInput,
        existingLinkedRecurringRuleId: existing.linkedRecurringRuleId
      });

        return tx.insurancePolicy.update({
          where: {
            id: insurancePolicyId
          },
          data: {
            accountId: normalizedInput.fundingAccountId,
            categoryId: normalizedInput.categoryId,
            recurringStartDate: normalizedInput.recurringStartDate,
            linkedRecurringRuleId,
            provider: normalizedInput.provider,
            normalizedProvider: normalizeCaseInsensitiveText(
              normalizedInput.provider
            ),
            productName: normalizedInput.productName,
            normalizedProductName: normalizeCaseInsensitiveText(
              normalizedInput.productName
            ),
            monthlyPremiumWon: normalizedInput.monthlyPremiumWon,
            paymentDay: normalizedInput.paymentDay,
            cycle: normalizedInput.cycle,
          renewalDate: normalizedInput.renewalDate,
          maturityDate: normalizedInput.maturityDate,
          isActive: normalizedInput.isActive
        },
        include: insurancePolicyInclude
      });
    });

    return mapInsurancePolicyToItem(updated);
  }

  async delete(
    user: AuthenticatedUser,
    insurancePolicyId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.insurancePoliciesRepository.findByIdInWorkspace(
      insurancePolicyId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return false;
    }

    return this.prisma.$transaction(async (tx) => {
      if (existing.linkedRecurringRuleId) {
        await tx.recurringRule.deleteMany({
          where: {
            id: existing.linkedRecurringRuleId,
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          }
        });
      }

      const deleted = await tx.insurancePolicy.deleteMany({
        where: {
          id: insurancePolicyId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      });

      return deleted.count > 0;
    });
  }

  private async assertNoDuplicateInsurancePolicy(input: {
    tenantId: string;
    ledgerId: string;
    provider: string;
    productName: string;
    excludeInsurancePolicyId?: string;
  }) {
    const items = await this.insurancePoliciesRepository.findAllInWorkspace(
      input.tenantId,
      input.ledgerId,
      {
        includeInactive: true
      }
    );
    const duplicate = items.find(
      (candidate) =>
        candidate.id !== input.excludeInsurancePolicyId &&
        normalizeCaseInsensitiveText(candidate.provider) ===
          normalizeCaseInsensitiveText(input.provider) &&
        normalizeCaseInsensitiveText(candidate.productName) ===
          normalizeCaseInsensitiveText(input.productName)
    );

    if (!duplicate) {
      return;
    }

    throw new ConflictException(
      duplicate.isActive
        ? '같은 보험사와 상품명의 보험 계약이 이미 있습니다.'
        : '같은 보험사와 상품명의 비활성 보험 계약이 있습니다. 기존 계약을 다시 활성화하거나 다른 이름을 사용해 주세요.'
    );
  }

  private async assertRecurringReferences(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      ledgerId: string;
      fundingAccountId: string;
      categoryId: string;
    }
  ) {
    const [fundingAccount, category] = await Promise.all([
      tx.account.findFirst({
        where: {
          id: input.fundingAccountId,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        },
        select: {
          id: true
        }
      }),
      tx.category.findFirst({
        where: {
          id: input.categoryId,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        },
        select: {
          id: true,
          kind: true
        }
      })
    ]);

    const missingReference = resolveMissingOwnedRecurringRuleReference({
      fundingAccountExists: Boolean(fundingAccount),
      categoryExists: Boolean(category)
    });

    if (missingReference === 'funding_account') {
      throw new NotFoundException('Funding account not found');
    }

    if (missingReference === 'category') {
      throw new NotFoundException('Category not found');
    }

    if (category?.kind !== CategoryKind.EXPENSE) {
      throw new BadRequestException(
        '보험 계약 카테고리는 지출 분류여야 합니다.'
      );
    }
  }

  private async syncLinkedRecurringRule(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      tenantId: string;
      ledgerId: string;
      input: NormalizedInsurancePolicyInput;
      existingLinkedRecurringRuleId?: string | null;
    }
  ) {
    const recurringRulePayload = buildInsuranceRecurringRulePayload(
      input.input
    );
    const schedule = prepareRecurringRuleSchedule({
      startDate: recurringRulePayload.startDate,
      endDate: recurringRulePayload.endDate,
      isActive: recurringRulePayload.isActive
    });

    const existingLinkedRule = input.existingLinkedRecurringRuleId
      ? await tx.recurringRule.findFirst({
          where: {
            id: input.existingLinkedRecurringRuleId,
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          select: {
            id: true
          }
        })
      : null;

    if (existingLinkedRule) {
      const updated = await tx.recurringRule.update({
        where: {
          id: existingLinkedRule.id
        },
        data: {
          accountId: recurringRulePayload.fundingAccountId,
          categoryId: recurringRulePayload.categoryId,
          title: recurringRulePayload.title,
          amountWon: recurringRulePayload.amountWon,
          frequency: recurringRulePayload.frequency,
          dayOfMonth: recurringRulePayload.dayOfMonth,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
          nextRunDate: schedule.nextRunDate
        },
        select: {
          id: true
        }
      });

      return updated.id;
    }

    const created = await tx.recurringRule.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        accountId: recurringRulePayload.fundingAccountId,
        categoryId: recurringRulePayload.categoryId,
        title: recurringRulePayload.title,
        amountWon: recurringRulePayload.amountWon,
        frequency: recurringRulePayload.frequency,
        dayOfMonth: recurringRulePayload.dayOfMonth,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
        nextRunDate: schedule.nextRunDate
      },
      select: {
        id: true
      }
    });

    return created.id;
  }
}

function normalizeInsurancePolicyInput(
  input: CreateInsurancePolicyRequest | UpdateInsurancePolicyRequest
): NormalizedInsurancePolicyInput {
  const provider = normalizeRequiredText(
    input.provider,
    '보험사 이름을 입력해 주세요.'
  );
  const productName = normalizeRequiredText(
    input.productName,
    '상품명을 입력해 주세요.'
  );
  const fundingAccountId = normalizeRequiredText(
    input.fundingAccountId,
    '반복 규칙에 사용할 자금수단을 선택해 주세요.'
  );
  const categoryId = normalizeRequiredText(
    input.categoryId,
    '반복 규칙에 사용할 카테고리를 선택해 주세요.'
  );
  const recurringStartDate = normalizeRequiredText(
    input.recurringStartDate,
    '반복 규칙 시작일을 입력해 주세요.'
  );
  const renewalDate = normalizeOptionalDateInput(input.renewalDate);
  const maturityDate = normalizeOptionalDateInput(input.maturityDate);

  if (maturityDate && renewalDate && maturityDate < renewalDate) {
    throw new BadRequestException('만기일은 갱신일보다 빠를 수 없습니다.');
  }

  if (maturityDate && maturityDate < recurringStartDate) {
    throw new BadRequestException(
      '만기일은 반복 규칙 시작일보다 빠를 수 없습니다.'
    );
  }

  if (readDateInputDay(recurringStartDate) !== input.paymentDay) {
    throw new BadRequestException(
      '반복 규칙 시작일의 날짜는 납부일과 같아야 합니다.'
    );
  }

  return {
    provider,
    productName,
    monthlyPremiumWon: requirePositiveMoneyWon(
      input.monthlyPremiumWon,
      '월 보험료는 0보다 큰 안전한 정수여야 합니다.'
    ),
    paymentDay: input.paymentDay,
    cycle: input.cycle,
    fundingAccountId,
    categoryId,
    recurringStartDate,
    renewalDate,
    maturityDate,
    isActive: input.isActive ?? true
  };
}

function buildInsuranceRecurringRulePayload(
  input: NormalizedInsurancePolicyInput
) {
  return {
    title: [input.provider, input.productName].filter(Boolean).join(' '),
    fundingAccountId: input.fundingAccountId,
    categoryId: input.categoryId,
    amountWon: input.monthlyPremiumWon,
    frequency:
      input.cycle === 'YEARLY'
        ? RecurrenceFrequency.YEARLY
        : RecurrenceFrequency.MONTHLY,
    dayOfMonth: input.paymentDay,
    startDate: input.recurringStartDate,
    endDate: input.maturityDate ?? undefined,
    isActive: input.isActive
  };
}

function normalizeRequiredText(value: string, message: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(message);
  }

  return normalizedValue;
}

function normalizeOptionalDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  return value;
}

function readDateInputDay(value: string) {
  const day = Number(value.slice(8, 10));

  return Number.isNaN(day) ? null : day;
}
