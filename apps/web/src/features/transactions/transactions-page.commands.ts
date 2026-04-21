'use client';

import type {
  AccountingPeriodItem,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { resolveStatusLabel } from '@/shared/ui/status-chip';

export function buildTransactionCompletedMessage(
  transaction: CollectedTransactionItem,
  mode: 'create' | 'edit'
) {
  return mode === 'edit'
    ? `${transaction.title} 수집 거래를 수정했고 ${resolveStatusLabel(transaction.postingStatus)} 상태로 반영했습니다.`
    : `${transaction.title} 수집 거래를 등록했고 ${resolveStatusLabel(transaction.postingStatus)} 상태로 반영했습니다.`;
}

export function readTransactionDrawerTitle(
  drawerMode: 'create' | 'edit' | null
) {
  return drawerMode === 'edit' ? '수집 거래 수정' : '수집 거래 등록';
}

export function readTransactionDrawerDescription(input: {
  drawerMode: 'create' | 'edit' | null;
  currentPeriod: AccountingPeriodItem | null;
  hasMultipleCollectingPeriods?: boolean;
}) {
  const periodScopeLabel = input.hasMultipleCollectingPeriods
    ? '열린 운영 기간'
    : input.currentPeriod?.monthLabel;

  if (input.drawerMode === 'edit') {
    return periodScopeLabel
      ? `${periodScopeLabel} 범위의 미확정 거래 내용을 수정합니다. 저장 결과는 검토 또는 전표 준비 상태로 다시 계산됩니다.`
      : '운영 기간이 열린 월에만 수집 거래를 수정할 수 있습니다.';
  }

  return periodScopeLabel
    ? `${periodScopeLabel} 범위 안의 거래만 직접 등록할 수 있습니다. 저장 즉시 검토 또는 전표 준비 상태로 분류됩니다.`
    : '운영 기간이 열린 월에만 수집 거래를 등록할 수 있습니다.';
}

export function readTransactionsDeleteDescription(
  transaction: CollectedTransactionItem | null
) {
  return transaction
    ? `"${transaction.title}" 수집 거래를 삭제할까요? 전표로 확정되지 않은 수집·검토·전표 준비 상태 거래만 삭제할 수 있습니다.`
    : '';
}
