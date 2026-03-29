import type {
  AccountingPeriodItem,
  FinancialStatementKind,
  FinancialStatementsView,
  GenerateFinancialStatementSnapshotsRequest
} from '@personal-erp/contracts';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export function financialStatementsQueryKey(periodId?: string | null) {
  return ['financial-statements', periodId ?? 'latest'] as const;
}

export function getFinancialStatements(periodId?: string | null) {
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : '';
  return fetchJson<FinancialStatementsView | null>(
    `/financial-statements${query}`,
    null
  );
}

export function generateFinancialStatements(
  payload: GenerateFinancialStatementSnapshotsRequest,
  fallback: FinancialStatementsView
) {
  return postJson<
    FinancialStatementsView,
    GenerateFinancialStatementSnapshotsRequest
  >('/financial-statements/generate', payload, fallback);
}

export function buildFinancialStatementsFallbackView(
  period: AccountingPeriodItem
): FinancialStatementsView {
  const kinds: FinancialStatementKind[] = [
    'STATEMENT_OF_FINANCIAL_POSITION',
    'MONTHLY_PROFIT_AND_LOSS',
    'CASH_FLOW_SUMMARY',
    'NET_WORTH_MOVEMENT'
  ];

  return {
    period,
    snapshots: kinds.map((statementKind, index) => ({
      id: `financial-statement-demo-${index + 1}`,
      periodId: period.id,
      monthLabel: period.monthLabel,
      statementKind,
      currency: 'KRW',
      createdAt: new Date().toISOString(),
      payload: {
        summary: [],
        sections: [],
        notes: ['데모 모드에서는 공식 재무제표 스냅샷을 빈 값으로 보여줍니다.']
      }
    }))
  };
}
