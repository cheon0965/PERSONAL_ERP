import type { FinancialStatementPayload } from '@personal-erp/contracts';
import { AccountSubjectKind, FinancialStatementKind } from '@prisma/client';

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
  const assets = input.closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'ASSET'
  );
  const liabilities = input.closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'LIABILITY'
  );
  const equity = input.closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'EQUITY'
  );
  const incomeLines = input.closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'INCOME'
  );
  const expenseLines = input.closingLines.filter(
    (line) => line.accountSubject.subjectKind === 'EXPENSE'
  );

  const cashFlowByFundingAccount = new Map<string, number>();
  for (const line of input.journalLines) {
    if (line.accountSubject.subjectKind !== 'ASSET' || !line.fundingAccount) {
      continue;
    }

    const current = cashFlowByFundingAccount.get(line.fundingAccount.name) ?? 0;
    cashFlowByFundingAccount.set(
      line.fundingAccount.name,
      current + (line.debitAmount - line.creditAmount)
    );
  }

  const operatingCashIn = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount > 0)
    .reduce((sum, amount) => sum + amount, 0);
  const operatingCashOut = [...cashFlowByFundingAccount.values()]
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  const netCashFlow = operatingCashIn - operatingCashOut;

  const closingNetWorth =
    input.closingSnapshot.totalAssetAmount -
    input.closingSnapshot.totalLiabilityAmount;

  return new Map([
    [
      FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      {
        summary: [
          {
            label: '자산 합계',
            amountWon: input.closingSnapshot.totalAssetAmount
          },
          {
            label: '부채 합계',
            amountWon: input.closingSnapshot.totalLiabilityAmount
          },
          {
            label: '자본 합계',
            amountWon: input.closingSnapshot.totalEquityAmount
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
            amountWon: incomeLines.reduce(
              (sum, line) => sum + line.balanceAmount,
              0
            )
          },
          {
            label: '월간 비용',
            amountWon: expenseLines.reduce(
              (sum, line) => sum + line.balanceAmount,
              0
            )
          },
          {
            label: '당기 손익',
            amountWon: input.closingSnapshot.periodPnLAmount
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
            amountWon: input.closingSnapshot.periodPnLAmount
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
                amountWon: input.closingSnapshot.periodPnLAmount
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
