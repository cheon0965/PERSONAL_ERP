import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  BulkConfirmCollectedTransactionsRequest,
  BulkConfirmCollectedTransactionsResponse
} from '@personal-erp/contracts';
import { CollectedTransactionStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';

@Injectable()
export class BulkConfirmCollectedTransactionsUseCase {
  constructor(
    private readonly prisma: PrismaService,
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
    const requestedIdSet = requestedIds ? new Set(requestedIds) : null;
    const readyTransactions = await this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: CollectedTransactionStatus.READY_TO_POST
      },
      select: {
        id: true
      },
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }]
    });
    const targetTransactions = requestedIdSet
      ? readyTransactions.filter((transaction) =>
          requestedIdSet.has(transaction.id)
        )
      : readyTransactions;

    if (!requestedIds && targetTransactions.length === 0) {
      throw new BadRequestException(
        '일괄 확정할 전표 준비 수집 거래가 없습니다.'
      );
    }

    const processedIds = new Set<string>();
    const results: BulkConfirmCollectedTransactionsResponse['results'] = [];

    for (const transaction of targetTransactions) {
      processedIds.add(transaction.id);

      try {
        const journalEntry =
          await this.confirmCollectedTransactionUseCase.execute(
            user,
            transaction.id
          );
        results.push({
          collectedTransactionId: transaction.id,
          status: 'CONFIRMED',
          journalEntryId: journalEntry.id,
          journalEntryNumber: journalEntry.entryNumber,
          message: `${journalEntry.entryNumber} 전표를 생성했습니다.`
        });
      } catch (error) {
        results.push({
          collectedTransactionId: transaction.id,
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
      requestedCount: requestedIds?.length ?? targetTransactions.length,
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
