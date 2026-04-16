import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import type {
  CreateInsurancePolicyRequest,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { CategoryKind, RecurrenceFrequency } from '@prisma/client';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import { resolveMissingOwnedRecurringRuleReference } from '../recurring-rules/public';

export type NormalizedInsurancePolicyInput = {
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

export type InsurancePolicyRecurringReferenceState = {
  fundingAccountExists: boolean;
  categoryExists: boolean;
  categoryKind: CategoryKind | null;
};

export function normalizeInsurancePolicyInput(
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

export function assertInsurancePolicyUnique(
  duplicate: { isActive: boolean } | null
): void {
  if (!duplicate) {
    return;
  }

  throw new ConflictException(
    duplicate.isActive
      ? '같은 보험사와 상품명의 보험 계약이 이미 있습니다.'
      : '같은 보험사와 상품명의 비활성 보험 계약이 있습니다. 기존 계약을 다시 활성화하거나 다른 이름을 사용해 주세요.'
  );
}

export function assertInsurancePolicyRecurringReferences(
  state: InsurancePolicyRecurringReferenceState
): void {
  const missingReference = resolveMissingOwnedRecurringRuleReference({
    fundingAccountExists: state.fundingAccountExists,
    categoryExists: state.categoryExists
  });

  if (missingReference === 'funding_account') {
    throw new NotFoundException('Funding account not found');
  }

  if (missingReference === 'category') {
    throw new NotFoundException('Category not found');
  }

  if (state.categoryKind !== CategoryKind.EXPENSE) {
    throw new BadRequestException(
      '보험 계약 카테고리는 지출 분류여야 합니다.'
    );
  }
}

export function buildInsuranceRecurringRulePayload(
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
