import type { CarryForwardView } from '@personal-erp/contracts';

export type CarryForwardPeriodSummary = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSING' | 'LOCKED';
};

export abstract class CarryForwardViewPort {
  abstract findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<CarryForwardPeriodSummary | null>;

  abstract findViewInWorkspace(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string
  ): Promise<CarryForwardView | null>;
}
