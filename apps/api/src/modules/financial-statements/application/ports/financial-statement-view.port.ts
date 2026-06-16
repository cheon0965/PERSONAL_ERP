import type { FinancialStatementsView } from '@personal-erp/contracts';

export abstract class FinancialStatementViewPort {
  abstract findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<FinancialStatementsView | null>;
}
