import type {
  CreateRecurringRuleRequest,
  RecurringRuleItem
} from '@personal-erp/contracts';
import {
  MissingOwnedRecurringRuleReferenceError,
  prepareRecurringRuleSchedule,
  resolveMissingOwnedRecurringRuleReference
} from '../../domain/recurring-rule-policy';
import type { ReferenceOwnershipPort } from '../ports/reference-ownership.port';
import type { RecurringRuleStorePort } from '../ports/recurring-rule-store.port';
import { mapRecurringRuleToItem } from '../recurring-rule-item.mapper';

type CreateRecurringRuleCommand = CreateRecurringRuleRequest & {
  userId: string;
  tenantId: string;
  ledgerId: string;
};

export class CreateRecurringRuleUseCase {
  constructor(
    private readonly recurringRuleStore: RecurringRuleStorePort,
    private readonly referenceOwnership: ReferenceOwnershipPort
  ) {}

  async execute(
    command: CreateRecurringRuleCommand
  ): Promise<RecurringRuleItem> {
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

    const rule = await this.recurringRuleStore.createInWorkspace({
      userId: command.userId,
      tenantId: command.tenantId,
      ledgerId: command.ledgerId,
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
    });

    return mapRecurringRuleToItem(rule);
  }
}
