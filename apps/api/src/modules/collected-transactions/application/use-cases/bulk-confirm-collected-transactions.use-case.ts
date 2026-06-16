import { ApplicationService } from '../../../../common/application/application-service.decorator';
import { validationError } from '../../../../common/application/errors/app-error';
import type {
  AuthenticatedUser,
  BulkConfirmCollectedTransactionsRequest,
  BulkConfirmCollectedTransactionsResponse
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { ConfirmCollectedTransactionStorePort } from '../ports/confirm-collected-transaction-store.port';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';

@ApplicationService()
export class BulkConfirmCollectedTransactionsUseCase {
  constructor(
    private readonly confirmStore: ConfirmCollectedTransactionStorePort,
    private readonly confirmCollectedTransactionUseCase: ConfirmCollectedTransactionUseCase
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: BulkConfirmCollectedTransactionsRequest
  ): Promise<BulkConfirmCollectedTransactionsResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.confirm'
    );

    const requestedIds = normalizeTransactionIds(input.transactionIds);
    const readyTransactionIds = await this.confirmStore.findReadyIds(
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      requestedIds
    );

    if (!requestedIds && readyTransactionIds.length === 0) {
      throw validationError('일괄 확정할 전표 준비 수집 거래가 없습니다.');
    }

    const processedIds = new Set<string>();
    const results: BulkConfirmCollectedTransactionsResponse['results'] = [];

    for (const transactionId of readyTransactionIds) {
      processedIds.add(transactionId);

      try {
        const journalEntry =
          await this.confirmCollectedTransactionUseCase.execute(
            user,
            transactionId
          );
        results.push({
          collectedTransactionId: transactionId,
          status: 'CONFIRMED',
          journalEntryId: journalEntry.id,
          journalEntryNumber: journalEntry.entryNumber,
          message: `${journalEntry.entryNumber} 전표를 생성했습니다.`
        });
      } catch (error) {
        results.push({
          collectedTransactionId: transactionId,
          status: 'FAILED',
          journalEntryId: null,
          journalEntryNumber: null,
          message:
            error instanceof Error
              ? error.message
              : '수집 거래를 전표로 확정하지 못했습니다.'
        });
      }
    }

    if (requestedIds) {
      requestedIds.forEach((transactionId) => {
        if (processedIds.has(transactionId)) {
          return;
        }

        results.push({
          collectedTransactionId: transactionId,
          status: 'SKIPPED',
          journalEntryId: null,
          journalEntryNumber: null,
          message:
            '전표 준비 상태가 아니거나 현재 작업공간의 수집 거래가 아닙니다.'
        });
      });
    }

    const succeededCount = results.filter(
      (result) => result.status === 'CONFIRMED'
    ).length;
    const skippedCount = results.filter(
      (result) => result.status === 'SKIPPED'
    ).length;
    const failedCount = results.filter(
      (result) => result.status === 'FAILED'
    ).length;

    return {
      requestedCount: requestedIds?.length ?? readyTransactionIds.length,
      processedCount: results.length,
      succeededCount,
      skippedCount,
      failedCount,
      results
    };
  }
}

function normalizeTransactionIds(transactionIds?: string[]): string[] | null {
  if (!transactionIds) {
    return null;
  }

  const normalized = [
    ...new Set(
      transactionIds
        .map((transactionId) => transactionId.trim())
        .filter(Boolean)
    )
  ];
  return normalized.length > 0 ? normalized : null;
}
