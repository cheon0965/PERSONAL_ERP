// eslint-disable-next-line no-restricted-imports
import type { AccountingPeriodStatus, Prisma } from '@prisma/client';
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

export type AllocatedJournalEntryNumber = {
  period: WritableAccountingPeriod;
  sequence: number;
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

  abstract claimJournalWritePeriodInTransaction(
    tx: Prisma.TransactionClient,
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<WritableAccountingPeriod>;

  abstract allocateJournalEntryNumberInTransaction(
    tx: Prisma.TransactionClient,
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<AllocatedJournalEntryNumber>;
}
