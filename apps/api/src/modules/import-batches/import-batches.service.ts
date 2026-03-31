import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectImportedRowRequest,
  CollectedTransactionItem,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import {
  ImportSourceKind,
  ImportedRowParseStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { readCollectingAccountingPeriodStatuses } from '../accounting-periods/accounting-period-transition.policy';
import {
  importBatchRecordInclude,
  mapImportBatchRecordToItem,
  type ImportBatchRecord
} from './import-batch.mapper';
import {
  buildSourceFingerprint,
  parseImportBatchContent,
  readParsedImportedRowPayload
} from './import-batch.policy';
import { resolveImportedRowAutoPreparation } from './imported-row-auto-preparation.policy';
import { resolvePlanItemAutoMatch } from './imported-row-plan-item-match.policy';

const createdCollectedTransactionSelect =
  Prisma.validator<Prisma.CollectedTransactionSelect>()({
    id: true,
    occurredOn: true,
    title: true,
    amount: true,
    fundingAccount: {
      select: {
        name: true
      }
    },
    category: {
      select: {
        name: true
      }
    }
  });

type CreatedCollectedTransactionRecord = Prisma.CollectedTransactionGetPayload<{
  select: typeof createdCollectedTransactionSelect;
}>;

@Injectable()
export class ImportBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  async findAll(user: AuthenticatedUser): Promise<ImportBatchItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const batches = await this.prisma.importBatch.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: importBatchRecordInclude,
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    return batches.map(mapImportBatchRecordToItem);
  }

  async findOne(
    user: AuthenticatedUser,
    importBatchId: string
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);
    const batch = await this.prisma.importBatch.findFirst({
      where: {
        id: importBatchId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: importBatchRecordInclude
    });

    if (!batch) {
      throw new NotFoundException('업로드 배치를 찾을 수 없습니다.');
    }

    return mapImportBatchRecordToItem(batch);
  }

  async create(
    user: AuthenticatedUser,
    input: CreateImportBatchRequest
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(workspace.membershipRole, 'import_batch.upload');

    const parsedBatch = parseImportBatchContent({
      sourceKind: input.sourceKind,
      content: input.content
    });
    const fileHash = createHash('sha256')
      .update(input.content, 'utf8')
      .digest('hex');

    const created = (await this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: null,
          sourceKind: input.sourceKind,
          fileName: input.fileName,
          fileHash,
          rowCount: parsedBatch.rowCount,
          parseStatus: parsedBatch.parseStatus,
          uploadedByMembershipId: workspace.membershipId
        }
      });

      const rows = [];
      for (const row of parsedBatch.rows) {
        rows.push(
          await tx.importedRow.create({
            data: {
              batchId: batch.id,
              rowNumber: row.rowNumber,
              rawPayload: row.rawPayload,
              parseStatus: row.parseStatus,
              parseError: row.parseError,
              sourceFingerprint: row.sourceFingerprint
            }
          })
        );
      }

      return {
        ...batch,
        rows
      };
    })) as ImportBatchRecord;

    return mapImportBatchRecordToItem(created);
  }

  async collectRow(
    user: AuthenticatedUser,
    importBatchId: string,
    importedRowId: string,
    input: CollectImportedRowRequest
  ): Promise<CollectedTransactionItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'collected_transaction.create'
    );

    const importedRow = await this.prisma.importedRow.findFirst({
      where: {
        id: importedRowId,
        batchId: importBatchId,
        batch: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      },
      select: {
        id: true,
        parseStatus: true,
        rawPayload: true,
        sourceFingerprint: true,
        createdCollectedTransaction: {
          select: {
            id: true
          }
        },
        batch: {
          select: {
            sourceKind: true
          }
        }
      }
    });

    assertImportedRowCanBeCollected(importedRow);

    const parsedRow = readParsedImportedRowPayload(importedRow.rawPayload);
    if (!parsedRow) {
      throw new BadRequestException(
        '파싱 완료 행의 정규화 결과를 읽을 수 없습니다.'
      );
    }

    const currentPeriod =
      await this.accountingPeriodsService.assertCollectingDateAllowed(
        user,
        parsedRow.occurredOn
      );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.importedRow.findFirst({
        where: {
          id: importedRowId,
          batchId: importBatchId,
          batch: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          }
        },
        select: {
          id: true,
          parseStatus: true,
          rawPayload: true,
          sourceFingerprint: true,
          createdCollectedTransaction: {
            select: {
              id: true
            }
          },
          batch: {
            select: {
              sourceKind: true
            }
          }
        }
      });

      assertImportedRowCanBeCollected(row);

      const normalizedRow = readParsedImportedRowPayload(row.rawPayload);
      if (!normalizedRow) {
        throw new BadRequestException(
          '파싱 완료 행의 정규화 결과를 읽을 수 없습니다.'
        );
      }

      const currentCollectingPeriod = await tx.accountingPeriod.findFirst({
        where: {
          id: currentPeriod.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [...readCollectingAccountingPeriodStatuses()]
          }
        },
        select: {
          id: true,
          startDate: true,
          endDate: true
        }
      });

      if (!currentCollectingPeriod) {
        throw new BadRequestException(
          '현재 Ledger에 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다.'
        );
      }

      const occurredOn = new Date(`${normalizedRow.occurredOn}T00:00:00.000Z`);
      if (
        occurredOn.getTime() < currentCollectingPeriod.startDate.getTime() ||
        occurredOn.getTime() >= currentCollectingPeriod.endDate.getTime()
      ) {
        throw new BadRequestException(
          '수집 거래 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
        );
      }

      const fundingAccount = await tx.account.findFirst({
        where: {
          id: input.fundingAccountId,
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

      const ledgerTransactionType = await tx.ledgerTransactionType.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          code: mapCollectedTransactionTypeToLedgerTransactionCode(input.type),
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

      const planItemCandidates = await tx.planItem.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: currentCollectingPeriod.id,
          status: PlanItemStatus.DRAFT,
          matchedCollectedTransaction: {
            is: null
          }
        },
        select: {
          id: true,
          plannedAmount: true,
          plannedDate: true,
          fundingAccountId: true,
          ledgerTransactionTypeId: true,
          categoryId: true
        }
      });

      const planItemMatch = resolvePlanItemAutoMatch({
        candidates: planItemCandidates,
        collected: {
          amount: normalizedRow.amount,
          occurredOn,
          fundingAccountId: fundingAccount.id,
          ledgerTransactionTypeId: ledgerTransactionType.id,
          categoryId: input.categoryId ?? null
        }
      });
      const matchedPlanItem =
        planItemMatch.outcome === 'matched'
          ? planItemCandidates.find(
              (candidate) => candidate.id === planItemMatch.planItemId
            ) ?? null
          : null;
      const sourceFingerprint =
        row.sourceFingerprint ??
        buildSourceFingerprint({
          sourceKind: row.batch.sourceKind,
          occurredOn: normalizedRow.occurredOn,
          amount: normalizedRow.amount,
          description: normalizedRow.title,
          sourceOrigin: null
        });
      const duplicateSourceFingerprint = sourceFingerprint
        ? await tx.collectedTransaction.findFirst({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              sourceFingerprint
            },
            select: {
              id: true
            }
          })
        : null;
      const autoPreparation = resolveImportedRowAutoPreparation({
        type: input.type,
        requestedCategoryId: input.categoryId ?? null,
        matchedPlanItemCategoryId: matchedPlanItem?.categoryId ?? null,
        hasDuplicateSourceFingerprint: Boolean(duplicateSourceFingerprint)
      });
      const category = autoPreparation.effectiveCategoryId
        ? await tx.category.findFirst({
            where: {
              id: autoPreparation.effectiveCategoryId,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            select: {
              id: true,
              name: true
            }
          })
        : null;

      if (autoPreparation.effectiveCategoryId && !category) {
        throw new NotFoundException('Category not found');
      }

      const matchedPlanItemId =
        autoPreparation.allowPlanItemMatch && matchedPlanItem
          ? matchedPlanItem.id
          : null;

      const createdCollectedTransaction = await tx.collectedTransaction.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: currentCollectingPeriod.id,
          importBatchId,
          importedRowId: row.id,
          matchedPlanItemId,
          ledgerTransactionTypeId: ledgerTransactionType.id,
          fundingAccountId: fundingAccount.id,
          categoryId: category?.id ?? null,
          title: normalizedRow.title,
          occurredOn,
          amount: normalizedRow.amount,
          status: autoPreparation.nextStatus,
          sourceFingerprint,
          memo: input.memo
        },
        select: createdCollectedTransactionSelect
      });

      if (matchedPlanItemId) {
        await tx.planItem.update({
          where: {
            id: matchedPlanItemId
          },
          data: {
            status: PlanItemStatus.MATCHED
          }
        });
      }

      return createdCollectedTransaction;
    });

    return mapCreatedCollectedTransactionToItem(created, input.type);
  }
}

type CollectableImportedRow = {
  id: string;
  parseStatus: ImportedRowParseStatus;
  rawPayload: Prisma.JsonValue;
  sourceFingerprint: string | null;
  createdCollectedTransaction: {
    id: string;
  } | null;
  batch: {
    sourceKind: ImportSourceKind;
  };
};

function assertImportedRowCanBeCollected(
  row: CollectableImportedRow | null
): asserts row is CollectableImportedRow {
  if (!row) {
    throw new NotFoundException('업로드 행을 찾을 수 없습니다.');
  }

  if (row.parseStatus !== ImportedRowParseStatus.PARSED) {
    throw new BadRequestException(
      '파싱 완료 행만 수집 거래로 승격할 수 있습니다.'
    );
  }

  if (row.createdCollectedTransaction) {
    throw new ConflictException('이미 수집 거래로 승격된 업로드 행입니다.');
  }
}

function mapCollectedTransactionTypeToLedgerTransactionCode(
  type: CollectImportedRowRequest['type']
): string {
  switch (type) {
    case 'INCOME':
      return 'INCOME_BASIC';
    case 'TRANSFER':
      return 'TRANSFER_BASIC';
    case 'EXPENSE':
    default:
      return 'EXPENSE_BASIC';
  }
}

function mapCreatedCollectedTransactionToItem(
  transaction: CreatedCollectedTransactionRecord,
  type: CollectImportedRowRequest['type']
): CollectedTransactionItem {
  return {
    id: transaction.id,
    businessDate: transaction.occurredOn.toISOString().slice(0, 10),
    title: transaction.title,
    type,
    amountWon: transaction.amount,
    fundingAccountName: transaction.fundingAccount.name,
    categoryName: transaction.category?.name ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: 'PENDING',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  };
}
