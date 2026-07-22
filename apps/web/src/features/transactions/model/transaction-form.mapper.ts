'use client';

import type {
  CollectedTransactionDetailItem,
  FundingAccountItem,
  UpdateCollectedTransactionRequest
} from '@personal-erp/contracts';
import type { TransactionFormInput } from './transaction-form.schema';

type PostingDimensionRequest = Pick<
  UpdateCollectedTransactionRequest,
  | 'ledgerTransactionTypeId'
  | 'counterpartyFundingAccountId'
  | 'fundingAccountDirection'
>;

export function mapDetailToFormInput(
  transaction: CollectedTransactionDetailItem
): TransactionFormInput {
  return {
    title: transaction.title,
    amountWon: transaction.amountWon,
    businessDate: transaction.businessDate,
    type: transaction.type,
    ledgerTransactionTypeId: transaction.ledgerTransactionTypeId ?? '',
    accountId: transaction.fundingAccountId,
    counterpartyFundingAccountId:
      transaction.counterpartyFundingAccountId ?? '',
    fundingAccountDirection: transaction.fundingAccountDirection ?? '',
    categoryId: transaction.categoryId ?? '',
    memo: transaction.memo ?? ''
  };
}

export function buildPreservedPostingDimensionPayload(
  values: Pick<
    TransactionFormInput,
    | 'type'
    | 'accountId'
    | 'ledgerTransactionTypeId'
    | 'counterpartyFundingAccountId'
    | 'fundingAccountDirection'
  >,
  initialTransaction: Pick<
    CollectedTransactionDetailItem,
    'type' | 'fundingAccountId'
  > | null
): PostingDimensionRequest {
  if (
    !initialTransaction ||
    values.type !== initialTransaction.type ||
    values.accountId !== initialTransaction.fundingAccountId
  ) {
    return {};
  }

  return {
    ...(values.ledgerTransactionTypeId
      ? { ledgerTransactionTypeId: values.ledgerTransactionTypeId }
      : {}),
    ...(values.counterpartyFundingAccountId
      ? { counterpartyFundingAccountId: values.counterpartyFundingAccountId }
      : {}),
    ...(values.fundingAccountDirection
      ? { fundingAccountDirection: values.fundingAccountDirection }
      : {})
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
