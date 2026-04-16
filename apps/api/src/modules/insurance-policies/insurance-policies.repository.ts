import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';

export const insurancePolicyInclude = {
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

  findDuplicateInWorkspace(
    tenantId: string,
    ledgerId: string,
    provider: string,
    productName: string,
    excludeInsurancePolicyId?: string
  ) {
    return this.prisma.insurancePolicy.findFirst({
      where: {
        tenantId,
        ledgerId,
        normalizedProvider: normalizeCaseInsensitiveText(provider),
        normalizedProductName: normalizeCaseInsensitiveText(productName),
        ...(excludeInsurancePolicyId
          ? {
              id: {
                not: excludeInsurancePolicyId
              }
            }
          : {})
      },
      select: {
        id: true,
        isActive: true
      }
    });
  }
}
