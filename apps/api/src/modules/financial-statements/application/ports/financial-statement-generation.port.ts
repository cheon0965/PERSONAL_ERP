import type { FinancialStatementPayload } from '@personal-erp/contracts';
import type { PrismaMoneyLike } from '../../../../common/money/prisma-money';
import type {
  AccountSubjectKind,
  AccountingPeriodStatus,
  FinancialStatementKind
} from '@prisma/client';

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
  totalAssetAmount: PrismaMoneyLike;
  totalLiabilityAmount: PrismaMoneyLike;
  totalEquityAmount: PrismaMoneyLike;
  periodPnLAmount: PrismaMoneyLike;
};

export type FinancialStatementGenerationContext = {
  period: FinancialStatementGenerationPeriod | null;
  closingSnapshot: FinancialStatementGenerationClosingSnapshot | null;
  closingLines: Array<{
    id: string;
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
    id: string;
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
