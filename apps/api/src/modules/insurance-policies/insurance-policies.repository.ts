import { Injectable } from '@nestjs/common';
import type {
  CreateInsurancePolicyRequest,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';

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
      }
    });
  }

  createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateInsurancePolicyRequest
  ) {
    return this.prisma.insurancePolicy.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        provider: input.provider,
        productName: input.productName,
        monthlyPremiumWon: input.monthlyPremiumWon,
        paymentDay: input.paymentDay,
        cycle: input.cycle,
        renewalDate: input.renewalDate,
        maturityDate: input.maturityDate,
        isActive: input.isActive ?? true
      }
    });
  }

  updateInWorkspace(
    insurancePolicyId: string,
    input: UpdateInsurancePolicyRequest
  ) {
    return this.prisma.insurancePolicy.update({
      where: {
        id: insurancePolicyId
      },
      data: {
        provider: input.provider,
        productName: input.productName,
        monthlyPremiumWon: input.monthlyPremiumWon,
        paymentDay: input.paymentDay,
        cycle: input.cycle,
        renewalDate: input.renewalDate,
        maturityDate: input.maturityDate,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
  }
}
