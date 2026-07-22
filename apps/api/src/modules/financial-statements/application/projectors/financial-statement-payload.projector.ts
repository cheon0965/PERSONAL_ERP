import type { FinancialStatementPayload } from '@personal-erp/contracts';
import {
  addMoneyWon,
  subtractMoneyWon,
  sumMoneyWon
} from '@personal-erp/money';
type AccountSubjectKind =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'INCOME'
  | 'EXPENSE';
type FinancialStatementKind =
  | 'STATEMENT_OF_FINANCIAL_POSITION'
  | 'MONTHLY_PROFIT_AND_LOSS'
  | 'CASH_FLOW_SUMMARY'
  | 'NET_WORTH_MOVEMENT';

const STATEMENT_KIND_ORDER: FinancialStatementKind[] = [
  'STATEMENT_OF_FINANCIAL_POSITION',
  'MONTHLY_PROFIT_AND_LOSS',
  'CASH_FLOW_SUMMARY',
  'NET_WORTH_MOVEMENT'
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
    totalAssetAmount: number;
    totalLiabilityAmount: number;
    totalEquityAmount: number;
    periodPnLAmount: number;
  };
  closingLines: Array<{
    balanceAmount: number;
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
    debitAmount: number;
    creditAmount: number;
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
  const closingSnapshot = input.closingSnapshot;
  const closingLines = input.closingLines;
  const journalLines = input.journalLines;
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
  const incomeStatementItems = aggregateProfitAndLossLines(incomeLines);
  const expenseStatementItems = aggregateProfitAndLossLines(expenseLines);

  const cashFlowByFundingAccount = new Map<string, number>();
  for (const line of journalLines) {
    if (line.accountSubject.subjectKind !== 'ASSET' || !line.fundingAccount) {
      continue;
    }

    const current = cashFlowByFundingAccount.get(line.fundingAccount.name) ?? 0;
    cashFlowByFundingAccount.set(
      line.fundingAccount.name,
      addMoneyWon(
        current,
        subtractMoneyWon(line.debitAmount, line.creditAmount)
      )
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
      'STATEMENT_OF_FINANCIAL_POSITION',
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
            items: [
              ...equity.map((line) => ({
                label: buildLineLabel(
                  line.accountSubject.name,
                  line.fundingAccount?.name
                ),
                amountWon: line.balanceAmount
              })),
              {
                label: '당기 손익',
                amountWon: closingSnapshot.periodPnLAmount
              }
            ]
          }
        ],
        notes: [
          `${input.monthLabel} 잠금 기준 ClosingSnapshot을 공식 재무상태표의 근거로 사용합니다.`
        ]
      }
    ],
    [
      'MONTHLY_PROFIT_AND_LOSS',
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
            items: incomeStatementItems
          },
          {
            title: '비용',
            items: expenseStatementItems
          }
        ],
        notes: [
          '월간 손익보고서는 잠금 분개표와 마감 스냅샷 기준 금액을 그대로 사용합니다.'
        ]
      }
    ],
    [
      'CASH_FLOW_SUMMARY',
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
      'NET_WORTH_MOVEMENT',
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
          '현재 운영 기간의 OpeningBalanceSnapshot을 기초 순자산 기준으로 사용합니다.'
        ]
      }
    ]
  ]);
}

function aggregateProfitAndLossLines(
  lines: Array<{
    balanceAmount: number;
    accountSubject: {
      code: string;
      name: string;
    };
  }>
) {
  const grouped = new Map<
    string,
    { code: string; label: string; amountWon: number }
  >();

  for (const line of lines) {
    const key = `${line.accountSubject.code}:${line.accountSubject.name}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amountWon = addMoneyWon(existing.amountWon, line.balanceAmount);
    } else {
      grouped.set(key, {
        code: line.accountSubject.code,
        label: line.accountSubject.name,
        amountWon: line.balanceAmount
      });
    }
  }

  return [...grouped.values()]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map(({ label, amountWon }) => ({ label, amountWon }));
}

function buildLineLabel(
  accountSubjectName: string,
  fundingAccountName: string | null | undefined
) {
  return fundingAccountName
    ? `${accountSubjectName} / ${fundingAccountName}`
    : accountSubjectName;
}
