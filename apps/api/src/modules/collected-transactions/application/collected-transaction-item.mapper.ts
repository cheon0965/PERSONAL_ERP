import type {
  CollectedTransactionDetailItem,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import type {
  StoredCollectedTransaction,
  StoredCollectedTransactionDetail
} from './ports/collected-transaction-store.port';

export function mapCollectedTransactionToItem(
  transaction: StoredCollectedTransaction
): CollectedTransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.businessDate.toISOString().slice(0, 10),
    title: transaction.title,
    type: transaction.type,
    amountWon: transaction.amountWon,
    ...(transaction.ledgerTransactionTypeId !== undefined
      ? { ledgerTransactionTypeId: transaction.ledgerTransactionTypeId }
      : {}),
    ...(transaction.ledgerTransactionTypeName !== undefined
      ? { ledgerTransactionTypeName: transaction.ledgerTransactionTypeName }
      : {}),
    ...(transaction.postingPolicyKey !== undefined
      ? { postingPolicyKey: transaction.postingPolicyKey }
      : {}),
    ...(transaction.fundingAccountDirection !== undefined
      ? { fundingAccountDirection: transaction.fundingAccountDirection }
      : {}),
    fundingAccountName: transaction.account.name,
    ...(transaction.counterpartyFundingAccountId !== undefined
      ? {
          counterpartyFundingAccountId: transaction.counterpartyFundingAccountId
        }
      : {}),
    ...(transaction.counterpartyAccount !== undefined
      ? {
          counterpartyFundingAccountName:
            transaction.counterpartyAccount?.name ?? null
        }
      : {}),
    categoryName: transaction.category?.name ?? '-',
    sourceKind: transaction.origin,
    postingStatus: transaction.status,
    postedJournalEntryId: transaction.postedJournalEntryId,
    postedJournalEntryNumber: transaction.postedJournalEntryNumber,
    matchedPlanItemId: transaction.matchedPlanItemId ?? null,
    matchedPlanItemTitle: transaction.matchedPlanItemTitle ?? null,
    ...(transaction.sourceLiabilityRepayment
      ? { sourceLiabilityRepayment: transaction.sourceLiabilityRepayment }
      : {}),
    ...(transaction.sourceVehicleLog
      ? { sourceVehicleLog: transaction.sourceVehicleLog }
      : {})
  };
}

export function mapCollectedTransactionToDetailItem(
  transaction: StoredCollectedTransactionDetail
): CollectedTransactionDetailItem {
  return {
    id: transaction.id,
    businessDate: transaction.businessDate.toISOString().slice(0, 10),
    title: transaction.title,
    type: transaction.type,
    amountWon: transaction.amountWon,
    ...(transaction.ledgerTransactionTypeId !== undefined
      ? { ledgerTransactionTypeId: transaction.ledgerTransactionTypeId }
      : {}),
    ...(transaction.ledgerTransactionTypeName !== undefined
      ? { ledgerTransactionTypeName: transaction.ledgerTransactionTypeName }
      : {}),
    ...(transaction.postingPolicyKey !== undefined
      ? { postingPolicyKey: transaction.postingPolicyKey }
      : {}),
    ...(transaction.fundingAccountDirection !== undefined
      ? { fundingAccountDirection: transaction.fundingAccountDirection }
      : {}),
    fundingAccountId: transaction.fundingAccountId,
    ...(transaction.counterpartyFundingAccountId !== undefined
      ? {
          counterpartyFundingAccountId: transaction.counterpartyFundingAccountId
        }
      : {}),
    categoryId: transaction.categoryId,
    memo: transaction.memo,
    sourceKind: transaction.origin,
    postingStatus: transaction.status,
    postedJournalEntryId: transaction.postedJournalEntryId,
    postedJournalEntryNumber: transaction.postedJournalEntryNumber,
    matchedPlanItemId: transaction.matchedPlanItemId ?? null,
    matchedPlanItemTitle: transaction.matchedPlanItemTitle ?? null,
    ...(transaction.sourceLiabilityRepayment
      ? { sourceLiabilityRepayment: transaction.sourceLiabilityRepayment }
      : {}),
    ...(transaction.sourceVehicleLog
      ? { sourceVehicleLog: transaction.sourceVehicleLog }
      : {})
  };
}
