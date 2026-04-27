import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import type { AccountSubjectKind } from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

/**
 * 월마감 스냅샷 라인과 합계를 계산하는 순수 정책 함수 모음입니다.
 *
 * DB 저장은 유스케이스가 담당하고, 이 파일은 기초 잔액과 전표 라인을 계정의 정상 잔액 방향에 맞춰
 * 합산하는 책임만 가집니다. 이렇게 분리하면 마감, 재무제표, 이월에서 같은 계산 기준을 재사용할 수 있습니다.
 */
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

export function aggregateClosingSnapshotLines(input: {
  openingBalanceLines?: OpeningBalanceLineForClosingSnapshot[];
  journalLines: JournalLineForClosingSnapshot[];
}): AggregatedClosingSnapshotLine[] {
  const grouped = new Map<string, AggregatedClosingSnapshotLine>();

  // 마감 잔액은 기초 스냅샷을 시작점으로 삼고, 그 위에 기간 중 확정 전표의 증감을 누적한다.
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
  // 계정의 정상 잔액 방향을 반영한다. 부채/자본/수익은 대변 증가,
  // 자산/비용은 차변 증가이므로 같은 전표 라인도 계정 종류에 따라 부호가 달라진다.
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

  // 기간 손익은 수익 - 비용으로 계산하고, 자본 합계에는 기존 자본 잔액과 당기 손익을 함께 반영한다.
  const periodPnLAmount = subtractMoneyWon(
    totalIncomeAmount,
    totalExpenseAmount
  );
  const totalEquityAmount = addMoneyWon(totalEquityBaseAmount, periodPnLAmount);

  return {
    totalAssetAmount,
    totalLiabilityAmount,
    totalEquityAmount,
    periodPnLAmount
  };
}
