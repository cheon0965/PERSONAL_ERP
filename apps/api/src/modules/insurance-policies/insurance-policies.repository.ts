import { Injectable } from '@nestjs/common';
import type {
  CreateInsurancePolicyRequest,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';

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
} satisfies Prisma.InsurancePolicyInclude;

@Injectable()
export class InsurancePoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(
    tenantId: string,
    ledgerId: string,
    input?: {
      includeInactive?: boolean;
    }
  ) {
    return this.prisma.insurancePolicy.findMany({
      where: {
        tenantId,
        ledgerId,
        ...(input?.includeInactive ? {} : { isActive: true })
      },
      include: insurancePolicyInclude,
      orderBy: input?.includeInactive
        ? [
            { isActive: 'desc' },
            { paymentDay: 'asc' },
            { provider: 'asc' },
            { productName: 'asc' }
          ]
        : [{ paymentDay: 'asc' }, { provider: 'asc' }, { productName: 'asc' }]
    });
  }

  findByIdInWorkspace(
    insurancePolicyId: string,
    tenantId: string,
    ledgerId: string
  ) {
    return this.prisma.insurancePolicy.findFirst({
      where: {
        id: insurancePolicyId,
        tenantId,
        ledgerId
      },
      include: insurancePolicyInclude
    });
  }

  createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateInsurancePolicyRequest,
    linkedRecurringRuleId: string | null
  ) {
    return this.prisma.insurancePolicy.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        accountId: input.fundingAccountId,
        categoryId: input.categoryId,
        recurringStartDate: input.recurringStartDate,
        linkedRecurringRuleId,
        provider: input.provider,
        normalizedProvider: normalizeCaseInsensitiveText(input.provider),
        productName: input.productName,
        normalizedProductName: normalizeCaseInsensitiveText(input.productName),
        monthlyPremiumWon: input.monthlyPremiumWon,
        paymentDay: input.paymentDay,
        cycle: input.cycle,
        renewalDate: input.renewalDate,
        maturityDate: input.maturityDate,
        isActive: input.isActive ?? true
      },
      include: insurancePolicyInclude
    });
  }

  updateInWorkspace(
    insurancePolicyId: string,
    input: UpdateInsurancePolicyRequest,
    linkedRecurringRuleId: string | null
  ) {
    return this.prisma.insurancePolicy.update({
      where: {
        id: insurancePolicyId
      },
      data: {
        accountId: input.fundingAccountId,
        categoryId: input.categoryId,
        recurringStartDate: input.recurringStartDate,
        linkedRecurringRuleId,
        provider: input.provider,
        normalizedProvider: normalizeCaseInsensitiveText(input.provider),
        productName: input.productName,
        normalizedProductName: normalizeCaseInsensitiveText(input.productName),
        monthlyPremiumWon: input.monthlyPremiumWon,
        paymentDay: input.paymentDay,
        cycle: input.cycle,
        renewalDate: input.renewalDate,
        maturityDate: input.maturityDate,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      },
      include: insurancePolicyInclude
    });
  }
}
