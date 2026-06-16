import type {
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { AccountingPeriodLifecyclePort } from '../ports/accounting-period-lifecycle.port';

@ApplicationService()
export class CloseAccountingPeriodUseCase {
  constructor(private readonly lifecycle: AccountingPeriodLifecyclePort) {}

  execute(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<CloseAccountingPeriodResponse> {
    return this.lifecycle.close(user, periodId, input);
  }
}
