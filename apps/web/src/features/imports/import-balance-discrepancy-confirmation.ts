import type { ImportBatchItem } from '@personal-erp/contracts';
import { formatWon } from '../../shared/lib/format';

export function buildBalanceDiscrepancyBulkCollectConfirmationMessage(input: {
  batch: Pick<
    ImportBatchItem,
    'balanceDiscrepancy' | 'fundingAccountName' | 'fileName'
  >;
  targetRowCount: number;
}): string | null {
  const discrepancy = input.batch.balanceDiscrepancy;

  if (!discrepancy) {
    return null;
  }

  const accountLabel = input.batch.fundingAccountName ?? '자금수단';
  const sign = discrepancy.differenceWon > 0 ? '+' : '';

  return [
    '잔액 불일치가 있는 업로드 배치입니다.',
    '',
    `배치: ${input.batch.fileName}`,
    `자금수단: ${accountLabel}`,
    `최초일자: ${discrepancy.referenceOccurredOn}`,
    `명세 거래후잔액: ${formatWon(discrepancy.importedBalanceWon)}`,
    `ERP 현재 장부 잔액: ${formatWon(discrepancy.ledgerBalanceWon)}`,
    `차액: ${sign}${formatWon(discrepancy.differenceWon)}`,
    '',
    `누락 거래나 기초잔액 차이를 확인한 뒤 ${input.targetRowCount}건을 일괄 등록할까요?`
  ].join('\n');
}
