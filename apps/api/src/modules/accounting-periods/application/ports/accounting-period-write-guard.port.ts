import type { AccountingPeriodStatus } from '@personal-erp/contracts';
import type { AccountingPeriodWorkspaceScope } from './accounting-period-reader.port';

export type WritableAccountingPeriod = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
};

export abstract class AccountingPeriodWriteGuardPort {
  abstract assertCollectingDateAllowed(
    workspace: AccountingPeriodWorkspaceScope,
    businessDate: string
  ): Promise<WritableAccountingPeriod>;

  abstract assertJournalEntryDateAllowed(
    workspace: AccountingPeriodWorkspaceScope,
    businessDate: string
  ): Promise<WritableAccountingPeriod>;
}
