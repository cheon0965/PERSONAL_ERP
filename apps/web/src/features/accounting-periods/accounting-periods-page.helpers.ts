import type { AccountSubjectItem } from '@personal-erp/contracts';
import {
  addMoneyWon,
  parseMoneyWon,
  subtractMoneyWon
} from '@personal-erp/money';
import type { PeriodFormInput } from './accounting-periods-page.types';

export function readMembershipRoleLabel(role: string | null) {
  switch (role) {
    case 'OWNER':
      return '소유자';
    case 'MANAGER':
      return '관리자';
    case 'EDITOR':
      return '편집자';
    case 'VIEWER':
      return '조회자';
    default:
      return role ?? '-';
  }
}

export function isBalanceSheetAccountSubject(
  accountSubject: AccountSubjectItem
) {
  return (
    accountSubject.subjectKind === 'ASSET' ||
    accountSubject.subjectKind === 'LIABILITY' ||
    accountSubject.subjectKind === 'EQUITY'
  );
}

export function buildOpeningBalanceTotals(
  lines: PeriodFormInput['openingBalanceLines'],
  accountSubjects: AccountSubjectItem[]
) {
  const accountSubjectById = new Map(
    accountSubjects.map((accountSubject) => [accountSubject.id, accountSubject])
  );

  const totals = lines.reduce(
    (accumulator, line) => {
      const accountSubject = accountSubjectById.get(line.accountSubjectId);
      const balanceAmount = parseMoneyWon(line.balanceAmount);
      if (!accountSubject || balanceAmount == null || balanceAmount <= 0) {
        return accumulator;
      }

      accumulator.hasLines = true;

      switch (accountSubject.subjectKind) {
        case 'ASSET':
          accumulator.assetAmount = addMoneyWon(
            accumulator.assetAmount,
            balanceAmount
          );
          break;
        case 'LIABILITY':
          accumulator.liabilityAmount = addMoneyWon(
            accumulator.liabilityAmount,
            balanceAmount
          );
          break;
        case 'EQUITY':
          accumulator.equityAmount = addMoneyWon(
            accumulator.equityAmount,
            balanceAmount
          );
          break;
        default:
          break;
      }

      return accumulator;
    },
    {
      assetAmount: 0,
      liabilityAmount: 0,
      equityAmount: 0,
      hasLines: false
    }
  );

  const balanceGapAmount = subtractMoneyWon(
    subtractMoneyWon(totals.assetAmount, totals.liabilityAmount),
    totals.equityAmount
  );

  return {
    ...totals,
    balanceGapAmount,
    isBalanced: balanceGapAmount === 0
  };
}

export function normalizeOptionalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
