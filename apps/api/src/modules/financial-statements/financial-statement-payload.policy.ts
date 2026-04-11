import type { FinancialStatementPayload } from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon, sumMoneyWon } from '@personal-erp/money';
import { AccountSubjectKind, FinancialStatementKind } from '@prisma/client';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

const STATEMENT_KIND_ORDER: FinancialStatementKind[] = [
  FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
  FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
  FinancialStatementKind.CASH_FLOW_SUMMARY,
  FinancialStatementKind.NET_WORTH_MOVEMENT
];

export function sortFinancialStatementSnapshots<
  T extends { statementKind: FinancialStatementKind }
>(snapshots: T[]) {
  return [...snapshots].sort(
    (left, right) =>
      STATEMENT_KIND_ORDER.indexOf(left.statementKind) -
      STATEMENT_KIND_ORDER.indexOf(right.statementKind)
  );
}

export function buildStatementPayloads(input: {
  monthLabel: string;
  closingSnapshot: {
    totalAssetAmount: PrismaMoneyLike;
    totalLiabilityAmount: PrismaMoneyLike;
    totalEquityAmount: PrismaMoneyLike;
    periodPnLAmount: PrismaMoneyLike;
  };
  closingLines: Array<{
    balanceAmount: PrismaMoneyLike;
    accountSubject: {
      code: string;
      name: string;
      subjectKind: AccountSubjectKind;
    };
    fundingAccount: {
      name: string;
    } | null;
  }>;
  journalLines: Array<{
    debitAmount: PrismaMoneyLike;
    creditAmount: PrismaMoneyLike;
    accountSubject: {
      code: string;
      name: string;
      subjectKind: AccountSubjectKind;
    };
    fundingAccount: {
      name: string;
    } | null;
  }>;
  openingNetWorth: number;
}): Map<FinancialStatementKind, FinancialStatementPayload> {
  const closingSnapshot = {
    totalAssetAmount: fromPrismaMoneyWon(input.closingSnapshot.totalAssetAmount),
    totalLiabilityAmount: fromPrismaMoneyWon(
      input.closingSnapshot.totalLiabilityAmount
    ),
    totalEquityAmount: fromPrismaMoneyWon(
      input.closingSnapshot.totalEquityAmount
    ),
    periodPnLAmount: fromPrismaMoneyWon(input.closingSnapshot.periodPnLAmount)
  };
  const closingLines = input.closingLines.map((line) => ({
    ...line,
    balanceAmount: fromPrismaMoneyWon(line.balanceAmount)
  }));
  const journalLines = input.journalLines.map((line) => ({
    ...line,
    debitAmount: fromPrismaMoneyWon(line.debitAmount),
    creditAmount: fromPrismaMoneyWon(line.creditAmount)
  }));
  const assets = closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'ASSET'
  );
  const liabilities = closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'LIABILITY'
  );
  const equity = closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'EQUITY'
  );
  const incomeLines = closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'INCOME'
  );
  const expenseLines = closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'EXPENSE'
  );

  const cashFlowByFundingAccount = new Map<string, number>();
  for (const line of journalLines) {
    if (line.accountSubject.subjectKind !== 'ASSET' || !line.fundingAccount) {
      continue;
    }

    const current = cashFlowByFundingAccount.get(line.fundingAccount.name) ?? 0;
    cashFlowByFundingAccount.set(
      line.fundingAccount.name,
      addMoneyWon(current, subtractMoneyWon(line.debitAmount, line.creditAmount))
    );
  }

  const operatingCashIn = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => addMoneyWon(sum, amount), 0);
  const operatingCashOut = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => addMoneyWon(sum, Math.abs(amount)), 0);
  const netCashFlow = subtractMoneyWon(operatingCashIn, operatingCashOut);

  const closingNetWorth = subtractMoneyWon(
    closingSnapshot.totalAssetAmount,
    closingSnapshot.totalLiabilityAmount
  );
  const monthlyIncomeAmount = sumMoneyWon(
    incomeLines.map((line) => line.balanceAmount)
  );
  const monthlyExpenseAmount = sumMoneyWon(
    expenseLines.map((line) => line.balanceAmount)
  );

  return new Map([
    [
      FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      {
        summary: [
          {
            label: '자산 합계',
            amountWon: closingSnapshot.totalAssetAmount
          },
          {
            label: '부채 합계',
            amountWon: closingSnapshot.totalLiabilityAmount
          },
          {
            label: '자본 합계',
            amountWon: closingSnapshot.totalEquityAmount
          }
        ],
        sections: [
          {
            title: '자산',
            items: assets.map((line) => ({
              label: buildLineLabel(
                line.accountSubject.name,
                line.fundingAccount?.name
              ),
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '부채',
            items: liabilities.map((line) => ({
              label: buildLineLabel(
                line.accountSubject.name,
                line.fundingAccount?.name
              ),
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '자본',
            items: equity.map((line) => ({
              label: buildLineLabel(
                line.accountSubject.name,
                line.fundingAccount?.name
              ),
              amountWon: line.balanceAmount
            }))
          }
        ],
        notes: [
          `${input.monthLabel} 잠금 기준 ClosingSnapshot을 공식 재무상태표의 근거로 사용합니다.`
        ]
      }
    ],
    [
      FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
      {
        summary: [
          {
            label: '월간 수익',
            amountWon: monthlyIncomeAmount
          },
          {
            label: '월간 비용',
            amountWon: monthlyExpenseAmount
          },
          {
            label: '당기 손익',
            amountWon: closingSnapshot.periodPnLAmount
          }
        ],
        sections: [
          {
            title: '수익',
            items: incomeLines.map((line) => ({
              label: line.accountSubject.name,
              amountWon: line.balanceAmount
            }))
          },
          {
            title: '비용',
            items: expenseLines.map((line) => ({
              label: line.accountSubject.name,
              amountWon: line.balanceAmount
            }))
          }
        ],
        notes: [
          '월간 손익보고서는 잠금 분개표와 마감 스냅샷 기준 금액을 그대로 사용합니다.'
        ]
      }
    ],
    [
      FinancialStatementKind.CASH_FLOW_SUMMARY,
      {
        summary: [
          { label: '현금 유입', amountWon: operatingCashIn },
          { label: '현금 유출', amountWon: operatingCashOut },
          { label: '순현금흐름', amountWon: netCashFlow }
        ],
        sections: [
          {
            title: '자금수단별 순현금흐름',
            items: [...cashFlowByFundingAccount.entries()].map(
              ([label, amountWon]) => ({
                label,
                amountWon
              })
            )
          }
        ],
        notes: [
          '1차 구현에서는 자금수단(FundingAccount)과 연결된 현금성 자산 라인 기준으로 요약합니다.'
        ]
      }
    ],
    [
      FinancialStatementKind.NET_WORTH_MOVEMENT,
      {
        summary: [
          { label: '기초 순자산', amountWon: input.openingNetWorth },
          {
            label: '당기 손익',
            amountWon: closingSnapshot.periodPnLAmount
          },
          { label: '기말 순자산', amountWon: closingNetWorth }
        ],
        sections: [
          {
            title: '순자산 변동',
            items: [
              { label: '기초 순자산', amountWon: input.openingNetWorth },
              {
                label: '당기 손익',
                amountWon: closingSnapshot.periodPnLAmount
              },
              {
                label: '기말 순자산',
                amountWon: closingNetWorth
              }
            ]
          }
        ],
        notes: [
          input.openingNetWorth === 0
            ? '이전 잠금 기준이 없어 기초 순자산은 0으로 시작합니다.'
            : '이전 잠금 기준 ClosingSnapshot을 기초 순자산 기준으로 사용합니다.'
        ]
      }
    ]
  ]);
}

function buildLineLabel(
  accountSubjectName: string,
  fundingAccountName: string | null | undefined
) {
  return fundingAccountName
    ? `${accountSubjectName} / ${fundingAccountName}`
    : accountSubjectName;
}
