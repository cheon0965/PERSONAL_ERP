import type { AccountSubjectKind } from '@prisma/client';

export type AggregatedClosingSnapshotLine = {
  accountSubjectId: string;
  accountSubjectCode: string;
  accountSubjectName: string;
  accountSubjectKind: AccountSubjectKind;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  balanceAmount: number;
};

type JournalLineForClosingSnapshot = {
  accountSubject: {
    id: string;
    code: string;
    name: string;
    subjectKind: AccountSubjectKind;
  };
  fundingAccount: {
    id: string;
    name: string;
  } | null;
  debitAmount: number;
  creditAmount: number;
};

export function aggregateClosingSnapshotLines(
  journalLines: JournalLineForClosingSnapshot[]
): AggregatedClosingSnapshotLine[] {
  const grouped = new Map<string, AggregatedClosingSnapshotLine>();

  for (const line of journalLines) {
    const balanceAmount = projectNaturalBalance(
      line.accountSubject.subjectKind,
      line.debitAmount,
      line.creditAmount
    );

    if (balanceAmount === 0) {
      continue;
    }

    const key = `${line.accountSubject.id}:${line.fundingAccount?.id ?? 'none'}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.balanceAmount += balanceAmount;
      continue;
    }

    grouped.set(key, {
      accountSubjectId: line.accountSubject.id,
      accountSubjectCode: line.accountSubject.code,
      accountSubjectName: line.accountSubject.name,
      accountSubjectKind: line.accountSubject.subjectKind,
      fundingAccountId: line.fundingAccount?.id ?? null,
      fundingAccountName: line.fundingAccount?.name ?? null,
      balanceAmount
    });
  }

  return [...grouped.values()].filter((line) => line.balanceAmount !== 0);
}

export function summarizeClosingSnapshot(
  lines: AggregatedClosingSnapshotLine[]
) {
  let totalAssetAmount = 0;
  let totalLiabilityAmount = 0;
  let totalEquityBaseAmount = 0;
  let totalIncomeAmount = 0;
  let totalExpenseAmount = 0;

  for (const line of lines) {
    switch (line.accountSubjectKind) {
      case 'ASSET':
        totalAssetAmount += line.balanceAmount;
        break;
      case 'LIABILITY':
        totalLiabilityAmount += line.balanceAmount;
        break;
      case 'EQUITY':
        totalEquityBaseAmount += line.balanceAmount;
        break;
      case 'INCOME':
        totalIncomeAmount += line.balanceAmount;
        break;
      case 'EXPENSE':
        totalExpenseAmount += line.balanceAmount;
        break;
      default:
        break;
    }
  }

  const periodPnLAmount = totalIncomeAmount - totalExpenseAmount;
  const totalEquityAmount = totalEquityBaseAmount + periodPnLAmount;

  return {
    totalAssetAmount,
    totalLiabilityAmount,
    totalEquityAmount,
    periodPnLAmount
  };
}

function projectNaturalBalance(
  subjectKind: AccountSubjectKind,
  debitAmount: number,
  creditAmount: number
) {
  switch (subjectKind) {
    case 'LIABILITY':
    case 'EQUITY':
    case 'INCOME':
      return creditAmount - debitAmount;
    case 'ASSET':
    case 'EXPENSE':
    default:
      return debitAmount - creditAmount;
  }
}
