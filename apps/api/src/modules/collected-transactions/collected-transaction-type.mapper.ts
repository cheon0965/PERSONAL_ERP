import type { CollectedTransactionType } from '@personal-erp/contracts';

export function mapCollectedTransactionTypeToLedgerTransactionCode(
  type: CollectedTransactionType
): string {
  switch (type) {
    case 'INCOME':
      return 'INCOME_BASIC';
    case 'TRANSFER':
      return 'TRANSFER_BASIC';
    case 'EXPENSE':
    default:
      return 'EXPENSE_BASIC';
  }
}
