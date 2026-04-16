import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../../../common/utils/normalize-unique-key.util';
import {
  prepareRecurringRuleSchedule
} from '../../../recurring-rules/public';
import type { InsurancePolicyRecord } from '../../insurance-policies.mapper';
import { insurancePolicyInclude } from '../../insurance-policies.repository';
import {
  buildInsuranceRecurringRulePayload,
  type NormalizedInsurancePolicyInput
} from '../../insurance-policy.write-model';
import {
  type CreateInsurancePolicyCommand,
  type DeleteInsurancePolicyCommand,
  InsurancePolicyWritePort,
  type InsurancePolicyReferenceStateInput,
  type UpdateInsurancePolicyCommand
} from '../../application/ports/insurance-policy-write.port';

@Injectable()
export class PrismaInsurancePolicyWriteAdapter
  implements InsurancePolicyWritePort
{
  constructor(private readonly prisma: PrismaService) {}

  async readRecurringReferenceState(
    input: InsurancePolicyReferenceStateInput
  ) {
    const [fundingAccount, category] = await Promise.all([
      this.prisma.account.findFirst({
        where: {
          id: input.fundingAccountId,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        },
        select: {
          id: true
        }
      }),
      this.prisma.category.findFirst({
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

    return {
      fundingAccountExists: Boolean(fundingAccount),
      categoryExists: Boolean(category),
      categoryKind: category?.kind ?? null
    };
  }

  createPolicy(
    input: CreateInsurancePolicyCommand
  ): Promise<InsurancePolicyRecord> {
    return this.prisma.$transaction(async (tx) => {
      const linkedRecurringRuleId = await this.syncLinkedRecurringRule(tx, {
        userId: input.userId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        input: input.input
      });

      return tx.insurancePolicy.create({
        data: this.buildCreatePolicyWriteData(input, linkedRecurringRuleId),
        include: insurancePolicyInclude
      });
    });
  }

  updatePolicy(
    input: UpdateInsurancePolicyCommand
  ): Promise<InsurancePolicyRecord> {
    return this.prisma.$transaction(async (tx) => {
      const linkedRecurringRuleId = await this.syncLinkedRecurringRule(tx, {
        userId: input.userId,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        input: input.input,
        existingLinkedRecurringRuleId: input.existingLinkedRecurringRuleId
      });

      return tx.insurancePolicy.update({
        where: {
          id: input.insurancePolicyId
        },
        data: this.buildUpdatePolicyWriteData(input, linkedRecurringRuleId),
        include: insurancePolicyInclude
      });
    });
  }

  deletePolicy(input: DeleteInsurancePolicyCommand): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (input.linkedRecurringRuleId) {
        await tx.recurringRule.deleteMany({
          where: {
            id: input.linkedRecurringRuleId,
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          }
        });
      }

      const deleted = await tx.insurancePolicy.deleteMany({
        where: {
          id: input.insurancePolicyId,
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        }
      });

      return deleted.count > 0;
    });
  }

  private buildCreatePolicyWriteData(
    input: CreateInsurancePolicyCommand,
    linkedRecurringRuleId: string | null
  ): Prisma.InsurancePolicyUncheckedCreateInput {
    return {
      userId: input.userId,
      tenantId: input.tenantId,
      ledgerId: input.ledgerId,
      accountId: input.input.fundingAccountId,
      categoryId: input.input.categoryId,
      recurringStartDate: input.input.recurringStartDate,
      linkedRecurringRuleId,
      provider: input.input.provider,
      normalizedProvider: normalizeCaseInsensitiveText(input.input.provider),
      productName: input.input.productName,
      normalizedProductName: normalizeCaseInsensitiveText(
        input.input.productName
      ),
      monthlyPremiumWon: input.input.monthlyPremiumWon,
      paymentDay: input.input.paymentDay,
      cycle: input.input.cycle,
      renewalDate: input.input.renewalDate,
      maturityDate: input.input.maturityDate,
      isActive: input.input.isActive
    };
  }

  private buildUpdatePolicyWriteData(
    input: UpdateInsurancePolicyCommand,
    linkedRecurringRuleId: string | null
  ): Prisma.InsurancePolicyUncheckedUpdateInput {
    return {
      accountId: input.input.fundingAccountId,
      categoryId: input.input.categoryId,
      recurringStartDate: input.input.recurringStartDate,
      linkedRecurringRuleId,
      provider: input.input.provider,
      normalizedProvider: normalizeCaseInsensitiveText(input.input.provider),
      productName: input.input.productName,
      normalizedProductName: normalizeCaseInsensitiveText(
        input.input.productName
      ),
      monthlyPremiumWon: input.input.monthlyPremiumWon,
      paymentDay: input.input.paymentDay,
      cycle: input.input.cycle,
      renewalDate: input.input.renewalDate,
      maturityDate: input.input.maturityDate,
      isActive: input.input.isActive
    };
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
