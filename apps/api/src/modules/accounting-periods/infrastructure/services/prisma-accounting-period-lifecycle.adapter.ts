import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  OpenAccountingPeriodRequest,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { AccountingPeriodLifecyclePort } from '../../application/ports/accounting-period-lifecycle.port';
import { PrismaCloseAccountingPeriodLifecycle } from './prisma-close-accounting-period.lifecycle';
import { PrismaOpenAccountingPeriodLifecycle } from './prisma-open-accounting-period.lifecycle';
import { PrismaReopenAccountingPeriodLifecycle } from './prisma-reopen-accounting-period.lifecycle';

@Injectable()
export class PrismaAccountingPeriodLifecycleAdapter extends AccountingPeriodLifecyclePort {
  constructor(
    private readonly openLifecycle: PrismaOpenAccountingPeriodLifecycle,
    private readonly closeLifecycle: PrismaCloseAccountingPeriodLifecycle,
    private readonly reopenLifecycle: PrismaReopenAccountingPeriodLifecycle
  ) {
    super();
  }

  open(user: AuthenticatedUser, input: OpenAccountingPeriodRequest) {
    return this.openLifecycle.execute(user, input);
  }

  close(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ) {
    return this.closeLifecycle.execute(user, periodId, input);
  }

  reopen(
    user: AuthenticatedUser,
    periodId: string,
    input: ReopenAccountingPeriodRequest
  ) {
    return this.reopenLifecycle.execute(user, periodId, input);
  }
}
