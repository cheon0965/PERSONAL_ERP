'use client';

import type {
  CollectedTransactionDetailItem,
  FundingAccountItem
} from '@personal-erp/contracts';
import type { TransactionFormInput } from './transaction-form.schema';

export function mapDetailToFormInput(
  transaction: CollectedTransactionDetailItem
): TransactionFormInput {
  return {
    title: transaction.title,
    amountWon: transaction.amountWon,
    businessDate: transaction.businessDate,
    type: transaction.type,
    accountId: transaction.fundingAccountId,
    categoryId: transaction.categoryId ?? '',
    memo: transaction.memo ?? ''
  };
}

export function readFundingAccountOptionLabel(
  fundingAccount: FundingAccountItem
) {
  switch (fundingAccount.status) {
    case 'INACTIVE':
      return `${fundingAccount.name} (비활성)`;
    case 'CLOSED':
      return `${fundingAccount.name} (종료)`;
    default:
      return fundingAccount.name;
  }
}
