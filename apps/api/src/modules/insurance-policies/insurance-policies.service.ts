import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateInsurancePolicyRequest,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapInsurancePolicyToItem } from './insurance-policies.mapper';
import { InsurancePoliciesRepository } from './insurance-policies.repository';

@Injectable()
export class InsurancePoliciesService {
  constructor(
    private readonly insurancePoliciesRepository: InsurancePoliciesRepository
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

    const created = await this.insurancePoliciesRepository.createInWorkspace(
      workspace.userId,
      workspace.tenantId,
      workspace.ledgerId,
      normalizedInput
    );

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

    const updated = await this.insurancePoliciesRepository.updateInWorkspace(
      insurancePolicyId,
      normalizedInput
    );

    return mapInsurancePolicyToItem(updated);
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
        candidate.provider.trim().toLowerCase() ===
          input.provider.toLowerCase() &&
        candidate.productName.trim().toLowerCase() ===
          input.productName.toLowerCase()
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
}

function normalizeInsurancePolicyInput(
  input: CreateInsurancePolicyRequest | UpdateInsurancePolicyRequest
) {
  const provider = normalizeRequiredText(
    input.provider,
    '보험사 이름을 입력해 주세요.'
  );
  const productName = normalizeRequiredText(
    input.productName,
    '상품명을 입력해 주세요.'
  );
  const renewalDate = normalizeOptionalDateInput(input.renewalDate);
  const maturityDate = normalizeOptionalDateInput(input.maturityDate);

  if (maturityDate && renewalDate && maturityDate < renewalDate) {
    throw new BadRequestException('만기일은 갱신일보다 빠를 수 없습니다.');
  }

  return {
    provider,
    productName,
    monthlyPremiumWon: input.monthlyPremiumWon,
    paymentDay: input.paymentDay,
    cycle: input.cycle,
    renewalDate,
    maturityDate,
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
