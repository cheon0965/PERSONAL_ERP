import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CloseAccountingPeriodRequest,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest,
  OpeningBalancePreview,
  PreviewOpeningBalanceRequest,
  ReopenAccountingPeriodRequest
} from '@personal-erp/contracts';

export abstract class AccountingPeriodLifecyclePort {
  abstract previewOpeningBalance(
    user: AuthenticatedUser,
    input: PreviewOpeningBalanceRequest
  ): Promise<OpeningBalancePreview>;

  abstract open(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem>;

  abstract close(
    user: AuthenticatedUser,
    periodId: string,
    input: CloseAccountingPeriodRequest
  ): Promise<CloseAccountingPeriodResponse>;

  abstract reopen(
    user: AuthenticatedUser,
    periodId: string,
    input: ReopenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem>;
}
