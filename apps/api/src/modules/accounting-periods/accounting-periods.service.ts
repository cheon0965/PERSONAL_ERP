import { Injectable } from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { AccountingPeriodReaderPort } from './application/ports/accounting-period-reader.port';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import type { AccountingPeriodRecord } from './accounting-period.records';

@Injectable()
export class AccountingPeriodsService {
  constructor(
    private readonly accountingPeriodReader: AccountingPeriodReaderPort
  ) {}

  async findAll(user: AuthenticatedUser): Promise<AccountingPeriodItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const periods = await this.accountingPeriodReader.findAllInWorkspace({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    });

    return periods.map(mapAccountingPeriodRecordToItem);
  }

  async findCurrent(
    user: AuthenticatedUser
  ): Promise<AccountingPeriodItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const currentPeriod =
      await this.accountingPeriodReader.findCurrentInWorkspace({
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      });

    return currentPeriod
      ? mapAccountingPeriodRecordToItem(currentPeriod)
      : null;
  }

  async findPeriodByIdInWorkspace(
    tenantId: string,
    ledgerId: string,
    periodId: string
  ): Promise<AccountingPeriodRecord | null> {
    return this.accountingPeriodReader.findByIdInWorkspace(
      {
        tenantId,
        ledgerId
      },
      periodId
    );
  }
}
