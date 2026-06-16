import type { LedgerTransactionTypeItem } from '@personal-erp/contracts';

type LedgerTransactionTypeRecord = LedgerTransactionTypeItem;

export function mapLedgerTransactionTypeRecordToItem(
  ledgerTransactionType: LedgerTransactionTypeRecord
): LedgerTransactionTypeItem {
  return {
    id: ledgerTransactionType.id,
    code: ledgerTransactionType.code,
    name: ledgerTransactionType.name,
    flowKind: ledgerTransactionType.flowKind,
    postingPolicyKey: ledgerTransactionType.postingPolicyKey,
    isActive: ledgerTransactionType.isActive
  };
}
