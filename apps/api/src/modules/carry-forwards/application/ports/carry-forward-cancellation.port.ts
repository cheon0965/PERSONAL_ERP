import type { CancelCarryForwardResponse } from '@personal-erp/contracts';

export abstract class CarryForwardCancellationPort {
  abstract cancelInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    carryForwardRecordId?: string;
    fromPeriodId?: string;
    reason?: string;
  }): Promise<CancelCarryForwardResponse>;
}
