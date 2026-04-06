import type {
  RecurringRuleItem,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';
import {
  InsuranceManagedRecurringRuleError,
  MissingOwnedRecurringRuleReferenceError,
  prepareRecurringRuleSchedule,
  resolveMissingOwnedRecurringRuleReference
} from '../../domain/recurring-rule-policy';
import { mapRecurringRuleToItem } from '../recurring-rule-item.mapper';
import type { ReferenceOwnershipPort } from '../ports/reference-ownership.port';
import type { RecurringRuleStorePort } from '../ports/recurring-rule-store.port';

type UpdateRecurringRuleCommand = UpdateRecurringRuleRequest & {
  recurringRuleId: string;
  tenantId: string;
  ledgerId: string;
};

export class UpdateRecurringRuleUseCase {
  constructor(
    private readonly recurringRuleStore: RecurringRuleStorePort,
    private readonly referenceOwnership: ReferenceOwnershipPort
  ) {}

  async execute(
    command: UpdateRecurringRuleCommand
  ): Promise<RecurringRuleItem | null> {
    const existing = await this.recurringRuleStore.findByIdInWorkspace(
      command.tenantId,
      command.ledgerId,
      command.recurringRuleId
    );

    if (!existing) {
      return null;
    }

    if (existing.linkedInsurancePolicyId) {
      throw new InsuranceManagedRecurringRuleError(
        existing.linkedInsurancePolicyId
      );
    }

    const [fundingAccountExists, categoryExists] = await Promise.all([
      this.referenceOwnership.fundingAccountExistsInWorkspace(
        command.tenantId,
        command.ledgerId,
        command.fundingAccountId
      ),
      this.referenceOwnership.categoryExistsInWorkspace(
        command.tenantId,
        command.ledgerId,
        command.categoryId
      )
    ]);

    const missingReference = resolveMissingOwnedRecurringRuleReference({
      fundingAccountExists,
      categoryExists
    });

    if (missingReference) {
      throw new MissingOwnedRecurringRuleReferenceError(missingReference);
    }

    const schedule = prepareRecurringRuleSchedule({
      startDate: command.startDate,
      endDate: command.endDate,
      isActive: command.isActive
    });

    const updated = await this.recurringRuleStore.updateInWorkspace(
      command.tenantId,
      command.ledgerId,
      {
        id: command.recurringRuleId,
        title: command.title,
        accountId: command.fundingAccountId,
        categoryId: command.categoryId,
        amountWon: command.amountWon,
        frequency: command.frequency,
        dayOfMonth: command.dayOfMonth,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
        nextRunDate: schedule.nextRunDate
      }
    );

    return mapRecurringRuleToItem(updated);
  }
}
