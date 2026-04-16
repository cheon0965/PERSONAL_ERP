import type { AccountingPeriodRecord } from '../../accounting-period.records';

export type AccountingPeriodWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export abstract class AccountingPeriodReaderPort {
  abstract findAllInWorkspace(
    workspace: AccountingPeriodWorkspaceScope
  ): Promise<AccountingPeriodRecord[]>;

  abstract findCurrentInWorkspace(
    workspace: AccountingPeriodWorkspaceScope
  ): Promise<AccountingPeriodRecord | null>;

  abstract findByIdInWorkspace(
    workspace: AccountingPeriodWorkspaceScope,
    periodId: string
  ): Promise<AccountingPeriodRecord | null>;
}
