import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { AccountingPeriodLifecyclePort } from '../ports/accounting-period-lifecycle.port';

@ApplicationService()
export class ReopenAccountingPeriodUseCase {
  constructor(private readonly lifecycle: AccountingPeriodLifecyclePort) {}

  execute(
    user: AuthenticatedUser,
    periodId: string,
    input: ReopenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    return this.lifecycle.reopen(user, periodId, input);
  }
}
