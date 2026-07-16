import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import { validationError } from '../../../common/application/errors/app-error';

export type BalanceSheetSubjectKind = 'ASSET' | 'LIABILITY' | 'EQUITY';

export type AccountingEquationTotals = {
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  totalEquityAmount: number;
};

export function summarizeAccountingEquationLines(
  lines: Array<{
    balanceAmount: number;
    accountSubjectKind: BalanceSheetSubjectKind;
  }>
): AccountingEquationTotals {
  const totals: AccountingEquationTotals = {
    totalAssetAmount: 0,
    totalLiabilityAmount: 0,
    totalEquityAmount: 0
  };

  for (const line of lines) {
    switch (line.accountSubjectKind) {
      case 'ASSET':
        totals.totalAssetAmount = addMoneyWon(
          totals.totalAssetAmount,
          line.balanceAmount
        );
        break;
      case 'LIABILITY':
        totals.totalLiabilityAmount = addMoneyWon(
          totals.totalLiabilityAmount,
          line.balanceAmount
        );
        break;
      case 'EQUITY':
        totals.totalEquityAmount = addMoneyWon(
          totals.totalEquityAmount,
          line.balanceAmount
        );
        break;
    }
  }

  return totals;
}

export function calculateAccountingEquationDifference(
  totals: AccountingEquationTotals
) {
  return subtractMoneyWon(
    totals.totalAssetAmount,
    addMoneyWon(totals.totalLiabilityAmount, totals.totalEquityAmount)
  );
}

export function assertAccountingEquationBalanced(
  totals: AccountingEquationTotals,
  message = '자산과 부채+자본 합계가 일치하지 않습니다.'
) {
  const difference = calculateAccountingEquationDifference(totals);
  if (difference !== 0) {
    throw validationError(`${message} 차액: ${difference}원`);
  }
}
