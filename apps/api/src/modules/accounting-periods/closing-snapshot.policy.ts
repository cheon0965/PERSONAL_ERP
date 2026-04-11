import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import type { AccountSubjectKind } from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

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
  debitAmount: PrismaMoneyLike;
  creditAmount: PrismaMoneyLike;
};

type OpeningBalanceLineForClosingSnapshot = {
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
  balanceAmount: PrismaMoneyLike;
};

export function aggregateClosingSnapshotLines(
  input: {
    openingBalanceLines?: OpeningBalanceLineForClosingSnapshot[];
    journalLines: JournalLineForClosingSnapshot[];
  }
): AggregatedClosingSnapshotLine[] {
  const grouped = new Map<string, AggregatedClosingSnapshotLine>();

  for (const line of input.openingBalanceLines ?? []) {
    accumulateClosingSnapshotLine(grouped, {
      accountSubject: line.accountSubject,
      fundingAccount: line.fundingAccount,
      balanceAmount: fromPrismaMoneyWon(line.balanceAmount)
    });
  }

  for (const line of input.journalLines) {
    accumulateClosingSnapshotLine(grouped, {
      accountSubject: line.accountSubject,
      fundingAccount: line.fundingAccount,
      balanceAmount: projectNaturalBalance(
        line.accountSubject.subjectKind,
        fromPrismaMoneyWon(line.debitAmount),
        fromPrismaMoneyWon(line.creditAmount)
      )
    });
  }

  return [...grouped.values()].filter((line) => line.balanceAmount !== 0);
}

function accumulateClosingSnapshotLine(
  grouped: Map<string, AggregatedClosingSnapshotLine>,
  input: {
    accountSubject: OpeningBalanceLineForClosingSnapshot['accountSubject'];
    fundingAccount: OpeningBalanceLineForClosingSnapshot['fundingAccount'];
    balanceAmount: number;
  }
) {
  if (input.balanceAmount === 0) {
    return;
  }

  const key = `${input.accountSubject.id}:${input.fundingAccount?.id ?? 'none'}`;
  const existing = grouped.get(key);

  if (existing) {
    existing.balanceAmount = addMoneyWon(
      existing.balanceAmount,
      input.balanceAmount
    );
    return;
  }

  grouped.set(key, {
    accountSubjectId: input.accountSubject.id,
    accountSubjectCode: input.accountSubject.code,
    accountSubjectName: input.accountSubject.name,
    accountSubjectKind: input.accountSubject.subjectKind,
    fundingAccountId: input.fundingAccount?.id ?? null,
    fundingAccountName: input.fundingAccount?.name ?? null,
    balanceAmount: input.balanceAmount
  });
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
      return subtractMoneyWon(creditAmount, debitAmount);
    case 'ASSET':
    case 'EXPENSE':
    default:
      return subtractMoneyWon(debitAmount, creditAmount);
  }
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
        totalAssetAmount = addMoneyWon(totalAssetAmount, line.balanceAmount);
        break;
      case 'LIABILITY':
        totalLiabilityAmount = addMoneyWon(
          totalLiabilityAmount,
          line.balanceAmount
        );
        break;
      case 'EQUITY':
        totalEquityBaseAmount = addMoneyWon(
          totalEquityBaseAmount,
          line.balanceAmount
        );
        break;
      case 'INCOME':
        totalIncomeAmount = addMoneyWon(totalIncomeAmount, line.balanceAmount);
        break;
      case 'EXPENSE':
        totalExpenseAmount = addMoneyWon(
          totalExpenseAmount,
          line.balanceAmount
        );
        break;
      default:
        break;
    }
  }

  const periodPnLAmount = subtractMoneyWon(
    totalIncomeAmount,
    totalExpenseAmount
  );
  const totalEquityAmount = addMoneyWon(
    totalEquityBaseAmount,
    periodPnLAmount
  );

  return {
    totalAssetAmount,
    totalLiabilityAmount,
    totalEquityAmount,
    periodPnLAmount
  };
}
