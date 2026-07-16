import type {
  RecurringRuleDetailItem,
  RecurringRuleItem
} from '@personal-erp/contracts';
import type {
  StoredRecurringRule,
  StoredRecurringRuleDetail
} from './ports/recurring-rule-store.port';

export function mapRecurringRuleToItem(
  rule: StoredRecurringRule
): RecurringRuleItem {
  return {
    id: rule.id,
    title: rule.title,
    amountWon: rule.amountWon,
    frequency: rule.frequency,
    nextRunDate: rule.nextRunDate?.toISOString().slice(0, 10) ?? null,
    linkedInsurancePolicyId: rule.linkedInsurancePolicyId,
    ledgerTransactionTypeId: rule.ledgerTransactionTypeId,
    ledgerTransactionTypeName: rule.ledgerTransactionTypeName,
    fundingAccountDirection: rule.fundingAccountDirection,
    fundingAccountName: rule.account.name,
    counterpartyFundingAccountId: rule.counterpartyFundingAccountId,
    counterpartyFundingAccountName: rule.counterpartyAccount?.name ?? null,
    categoryName: rule.category?.name ?? '-',
    isActive: rule.isActive
  };
}

export function mapRecurringRuleToDetailItem(
  rule: StoredRecurringRuleDetail
): RecurringRuleDetailItem {
  return {
    id: rule.id,
    title: rule.title,
    fundingAccountId: rule.accountId,
    ledgerTransactionTypeId: rule.ledgerTransactionTypeId,
    counterpartyFundingAccountId: rule.counterpartyFundingAccountId,
    fundingAccountDirection: rule.fundingAccountDirection,
    categoryId: rule.categoryId,
    amountWon: rule.amountWon,
    frequency: rule.frequency,
    dayOfMonth: rule.dayOfMonth,
    startDate: rule.startDate.toISOString().slice(0, 10),
    endDate: rule.endDate?.toISOString().slice(0, 10) ?? null,
    nextRunDate: rule.nextRunDate?.toISOString().slice(0, 10) ?? null,
    linkedInsurancePolicyId: rule.linkedInsurancePolicyId,
    isActive: rule.isActive
  };
}
