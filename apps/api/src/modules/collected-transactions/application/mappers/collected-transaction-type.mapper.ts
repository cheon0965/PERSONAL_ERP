import type {
  AccountType,
  CollectedTransactionType
} from '@personal-erp/contracts';

export function mapCollectedTransactionTypeToLedgerTransactionCode(
  type: CollectedTransactionType,
  fundingAccountType?: AccountType
): string {
  switch (type) {
    case 'INCOME':
      return 'INCOME_BASIC';
    case 'REVERSAL':
      return 'MANUAL_ADJUSTMENT';
    case 'TRANSFER':
      return 'TRANSFER_BASIC';
    case 'EXPENSE':
      return fundingAccountType === 'CARD' ? 'CARD_SPEND' : 'EXPENSE_BASIC';
    default:
      return 'EXPENSE_BASIC';
  }
}
