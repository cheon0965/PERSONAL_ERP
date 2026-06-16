import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { AccountingPeriodLifecyclePort } from '../ports/accounting-period-lifecycle.port';

@ApplicationService()
export class OpenAccountingPeriodUseCase {
  constructor(private readonly lifecycle: AccountingPeriodLifecyclePort) {}

  execute(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    return this.lifecycle.open(user, input);
  }
}
