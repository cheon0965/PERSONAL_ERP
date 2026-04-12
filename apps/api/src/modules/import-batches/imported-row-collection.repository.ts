import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type { CollectImportedRowRequest } from '@personal-erp/contracts';
import {
  CollectedTransactionStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/accounting-period-transition.policy';
import { mapCollectedTransactionTypeToLedgerTransactionCode } from '../collected-transactions/public';
import { assertImportedRowCanBeCollected } from './imported-row-collection.normalization.policy';
import { resolveMatchedPlanItemCandidate } from './imported-row-collection-plan-item.policy';
import {
  collectableImportedRowSelect,
  collectingPeriodSelect,
  createdCollectedTransactionSelect,
  type CollectableImportedRow,
  type CollectingPeriodRecord,
  type CreatedCollectedTransactionRecord,
  type PlanItemCollectionCandidate
} from './imported-row-collection.types';

export type WorkspaceContext = ReturnType<typeof requireCurrentWorkspace>;
export type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export class ImportedRowCollectionRepository {
  async readCollectableImportedRow(
    client: PrismaClientLike,
    workspace: WorkspaceContext,
    importBatchId: string,
    importedRowId: string
  ): Promise<CollectableImportedRow> {
    const row = await client.importedRow.findFirst({
      where: {
        id: importedRowId,
        batchId: importBatchId,
        batch: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      },
      select: collectableImportedRowSelect
    });

    assertImportedRowCanBeCollected(row);
    return row;
  }

  async readCurrentCollectingPeriod(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<CollectingPeriodRecord> {
    const currentCollectingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        status: {
          in: [...readCollectingAccountingPeriodStatuses()]
        }
      },
      select: collectingPeriodSelect
    });

    if (!currentCollectingPeriod) {
      throw new BadRequestException(
        '현재 Ledger에 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다.'
      );
    }

    return currentCollectingPeriod;
  }

  async readFundingAccount(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    fundingAccountId: string
  ): Promise<{ id: string; name: string }> {
    const fundingAccount = await tx.account.findFirst({
      where: {
        id: fundingAccountId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!fundingAccount) {
      throw new NotFoundException('Funding account not found');
    }

    return fundingAccount;
  }

  async readLedgerTransactionTypeId(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    type: CollectImportedRowRequest['type']
  ): Promise<string> {
    const ledgerTransactionType = await tx.ledgerTransactionType.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        code: mapCollectedTransactionTypeToLedgerTransactionCode(type),
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!ledgerTransactionType) {
      throw new InternalServerErrorException(
        '현재 Ledger에 수집 거래용 기본 거래유형 마스터가 준비되어 있지 않습니다.'
      );
    }

    return ledgerTransactionType.id;
  }

  private async readDraftPlanItemCandidates(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<PlanItemCollectionCandidate[]> {
    const records = await tx.planItem.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId,
        status: PlanItemStatus.DRAFT,
        matchedCollectedTransaction: {
          is: null
        }
      },
      select: {
        id: true,
        title: true,
        plannedAmount: true,
        plannedDate: true,
        fundingAccountId: true,
        ledgerTransactionTypeId: true,
        categoryId: true
      }
    });

    return records.map((record) => ({
      ...record,
      plannedAmount: fromPrismaMoneyWon(record.plannedAmount),
      existingCollectedTransactionId: null
    }));
  }

  private async readRecurringCollectedTransactionCandidates(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<PlanItemCollectionCandidate[]> {
    const records = await tx.collectedTransaction.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId,
        importBatchId: null,
        importedRowId: null,
        matchedPlanItemId: {
          not: null
        },
        status: {
          in: [
            CollectedTransactionStatus.COLLECTED,
            CollectedTransactionStatus.REVIEWED,
            CollectedTransactionStatus.READY_TO_POST
          ]
        }
      },
      select: {
        id: true,
        occurredOn: true,
        amount: true,
        fundingAccountId: true,
        ledgerTransactionTypeId: true,
        categoryId: true,
        matchedPlanItem: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return records.flatMap((record) =>
      record.matchedPlanItem
        ? [
            {
              id: record.matchedPlanItem.id,
              title: record.matchedPlanItem.title,
              plannedAmount: fromPrismaMoneyWon(record.amount),
              plannedDate: record.occurredOn,
              fundingAccountId: record.fundingAccountId,
              ledgerTransactionTypeId: record.ledgerTransactionTypeId,
              categoryId: record.categoryId,
              existingCollectedTransactionId: record.id
            }
          ]
        : []
    );
  }

  private async readPlanItemCollectionCandidates(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    periodId: string
  ): Promise<PlanItemCollectionCandidate[]> {
    const [draftCandidates, recurringCandidates] = await Promise.all([
      this.readDraftPlanItemCandidates(tx, workspace, periodId),
      this.readRecurringCollectedTransactionCandidates(tx, workspace, periodId)
    ]);

    return [...draftCandidates, ...recurringCandidates];
  }

  async readMatchedPlanItemCandidate(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    periodId: string,
    amount: number,
    occurredOn: Date,
    fundingAccountId: string,
    ledgerTransactionTypeId: string,
    categoryId: string | null
  ): Promise<PlanItemCollectionCandidate | null> {
    const candidates = await this.readPlanItemCollectionCandidates(
      tx,
      workspace,
      periodId
    );

    return resolveMatchedPlanItemCandidate({
      candidates,
      amount,
      occurredOn,
      fundingAccountId,
      ledgerTransactionTypeId,
      categoryId
    });
  }

  async hasDuplicateSourceFingerprint(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    sourceFingerprint: string
  ): Promise<boolean> {
    const duplicateSourceFingerprint = await tx.collectedTransaction.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        sourceFingerprint
      },
      select: {
        id: true
      }
    });

    return Boolean(duplicateSourceFingerprint);
  }

  async createCollectedTransactionRecord(input: {
    tx: Prisma.TransactionClient;
    workspace: WorkspaceContext;
    importBatchId: string;
    importedRowId: string;
    periodId: string;
    matchedPlanItemId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    title: string;
    occurredOn: Date;
    amount: number;
    status: Prisma.CollectedTransactionCreateInput['status'];
    sourceFingerprint: string;
    memo: string | undefined;
  }): Promise<CreatedCollectedTransactionRecord> {
    return input.tx.collectedTransaction.create({
      data: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        periodId: input.periodId,
        importBatchId: input.importBatchId,
        importedRowId: input.importedRowId,
        matchedPlanItemId: input.matchedPlanItemId,
        ledgerTransactionTypeId: input.ledgerTransactionTypeId,
        fundingAccountId: input.fundingAccountId,
        categoryId: input.categoryId,
        title: input.title,
        occurredOn: input.occurredOn,
        amount: input.amount,
        status: input.status,
        sourceFingerprint: input.sourceFingerprint,
        memo: input.memo
      },
      select: createdCollectedTransactionSelect
    });
  }

  async absorbImportedRowIntoCollectedTransactionRecord(input: {
    tx: Prisma.TransactionClient;
    collectedTransactionId: string;
    matchedPlanItemId: string;
    importBatchId: string;
    importedRowId: string;
    periodId: string;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    title: string;
    occurredOn: Date;
    amount: number;
    status: Prisma.CollectedTransactionCreateInput['status'];
    sourceFingerprint: string;
    memo: string | undefined;
  }): Promise<CreatedCollectedTransactionRecord> {
    const claimed = await input.tx.collectedTransaction.updateMany({
      where: {
        id: input.collectedTransactionId,
        matchedPlanItemId: input.matchedPlanItemId,
        importBatchId: null,
        importedRowId: null,
        status: {
          in: [
            CollectedTransactionStatus.COLLECTED,
            CollectedTransactionStatus.REVIEWED,
            CollectedTransactionStatus.READY_TO_POST
          ]
        }
      },
      data: {
        periodId: input.periodId,
        importBatchId: input.importBatchId,
        importedRowId: input.importedRowId,
        ledgerTransactionTypeId: input.ledgerTransactionTypeId,
        fundingAccountId: input.fundingAccountId,
        categoryId: input.categoryId,
        title: input.title,
        occurredOn: input.occurredOn,
        amount: input.amount,
        status: input.status,
        sourceFingerprint: input.sourceFingerprint,
        ...(input.memo !== undefined ? { memo: input.memo } : {})
      }
    });

    if (claimed.count !== 1) {
      const latest = await input.tx.collectedTransaction.findFirst({
        where: {
          id: input.collectedTransactionId
        },
        select: {
          id: true,
          importBatchId: true,
          importedRowId: true,
          matchedPlanItemId: true
        }
      });

      if (!latest) {
        throw new NotFoundException('수집 거래를 찾을 수 없습니다.');
      }

      if (
        latest.importBatchId ||
        latest.importedRowId ||
        latest.matchedPlanItemId !== input.matchedPlanItemId
      ) {
        throw new ConflictException(
          '이미 다른 업로드 행과 연결된 반복 수집 거래입니다. 다시 새로고침해 주세요.'
        );
      }

      throw new ConflictException(
        '반복 수집 거래 상태가 변경되어 업로드 행을 연결하지 못했습니다. 다시 시도해 주세요.'
      );
    }

    const updated = await input.tx.collectedTransaction.findFirst({
      where: {
        id: input.collectedTransactionId
      },
      select: createdCollectedTransactionSelect
    });

    if (!updated) {
      throw new NotFoundException('수집 거래를 찾을 수 없습니다.');
    }

    return updated;
  }

  async markPlanItemMatched(
    tx: Prisma.TransactionClient,
    matchedPlanItemId: string | null
  ): Promise<void> {
    if (!matchedPlanItemId) {
      return;
    }

    await tx.planItem.update({
      where: {
        id: matchedPlanItemId
      },
      data: {
        status: PlanItemStatus.MATCHED
      }
    });
  }

  async readEffectiveCategory(
    tx: PrismaClientLike,
    workspace: WorkspaceContext,
    categoryId: string | null
  ): Promise<{ id: string; name: string } | null> {
    if (!categoryId) {
      return null;
    }

    const category = await tx.category.findFirst({
      where: {
        id: categoryId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
