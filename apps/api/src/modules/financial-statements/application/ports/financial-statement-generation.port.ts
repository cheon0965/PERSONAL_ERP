import type { FinancialStatementPayload } from '@personal-erp/contracts';
type AccountSubjectKind =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'INCOME'
  | 'EXPENSE';
type AccountingPeriodStatus = 'OPEN' | 'IN_REVIEW' | 'CLOSING' | 'LOCKED';
type FinancialStatementKind =
  | 'STATEMENT_OF_FINANCIAL_POSITION'
  | 'MONTHLY_PROFIT_AND_LOSS'
  | 'CASH_FLOW_SUMMARY'
  | 'NET_WORTH_MOVEMENT';

export type FinancialStatementGenerationPeriod = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  ledger: {
    baseCurrency: string;
  };
};

export type FinancialStatementGenerationClosingSnapshot = {
  id: string;
  totalAssetAmount: number;
  totalLiabilityAmount: number;
  totalEquityAmount: number;
  periodPnLAmount: number;
};

export type FinancialStatementGenerationContext = {
  period: FinancialStatementGenerationPeriod | null;
  closingSnapshot: FinancialStatementGenerationClosingSnapshot | null;
  closingLines: Array<{
    id: string;
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
    id: string;
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
  previousClosingSnapshot: FinancialStatementGenerationClosingSnapshot | null;
};

export abstract class FinancialStatementGenerationPort {
  abstract readGenerationContext(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<FinancialStatementGenerationContext>;

  abstract upsertStatementSnapshots(input: {
    tenantId: string;
    ledgerId: string;
    periodId: string;
    currency: string;
    payloads: Array<[FinancialStatementKind, FinancialStatementPayload]>;
  }): Promise<void>;
}
