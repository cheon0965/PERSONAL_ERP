import type { PlanItemsView } from '@personal-erp/contracts';

export abstract class PlanItemViewPort {
  abstract findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<PlanItemsView | null>;
}
