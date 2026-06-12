import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchBalanceDiscrepancy,
  ImportBatchItem
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import {
  AccountType,
  ImportedRowParseStatus,
  type Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { readWorkspaceFundingAccountLiveBalances } from '../../../funding-accounts/funding-account-live-balance.reader';
import {
  type ImportBatchRecord,
  importBatchRecordInclude,
  mapImportBatchRecordToItem
} from '../mappers/import-batch.mapper';
import { readParsedImportedRowPayload } from '../parsers/delimited-import-batch.parser';

type BalanceReference = Pick<
  ImportBatchBalanceDiscrepancy,
  'importedBalanceWon' | 'referenceOccurredOn' | 'referenceRowNumber'
>;

@Injectable()
export class ImportBatchQueryService {
  constructor(private readonly prisma: PrismaService) {}

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

    const items = batches.map(mapImportBatchRecordToItem);

    await this.attachBalanceDiscrepancies({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      batches,
      items
    });

    return items;
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

    const item = mapImportBatchRecordToItem(batch);

    await this.attachBalanceDiscrepancies({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      batches: [batch],
      items: [item]
    });

    return item;
  }

  private async attachBalanceDiscrepancies(input: {
    tenantId: string;
    ledgerId: string;
    batches: ImportBatchRecord[];
    items: ImportBatchItem[];
  }): Promise<void> {
    const candidates: Array<{
      item: ImportBatchItem;
      fundingAccountId: string;
      reference: BalanceReference;
    }> = [];

    for (const [index, batch] of input.batches.entries()) {
      const item = input.items[index];

      if (
        !item ||
        !batch.fundingAccountId ||
        batch.fundingAccount?.type !== AccountType.BANK
      ) {
        continue;
      }

      const reference = this.readFirstDatedBalanceReference(batch.rows);

      if (!reference) {
        continue;
      }

      candidates.push({
        item,
        fundingAccountId: batch.fundingAccountId,
        reference
      });
    }

    if (candidates.length === 0) {
      return;
    }

    const accounts = await readWorkspaceFundingAccountLiveBalances(
      this.prisma,
      {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      },
      { includeInactive: true }
    );
    const ledgerBalanceByAccountId = new Map(
      accounts.map((account) => [account.id, account.balanceWon])
    );

    for (const candidate of candidates) {
      const ledgerBalanceWon = ledgerBalanceByAccountId.get(
        candidate.fundingAccountId
      );

      if (ledgerBalanceWon == null) {
        continue;
      }

      const differenceWon = subtractMoneyWon(
        candidate.reference.importedBalanceWon,
        ledgerBalanceWon
      );

      if (differenceWon === 0) {
        continue;
      }

      candidate.item.balanceDiscrepancy = {
        ...candidate.reference,
        ledgerBalanceWon,
        differenceWon
      };
    }
  }

  /**
   * 배치의 최초 거래일 행에서 거래후잔액을 읽고 장부 잔액 비교 기준으로 삼는다.
   */
  private readFirstDatedBalanceReference(
    rows: ImportBatchRecord['rows']
  ): BalanceReference | null {
    const candidates: BalanceReference[] = [];

    for (const row of rows) {
      if (row.parseStatus !== ImportedRowParseStatus.PARSED) {
        continue;
      }

      const parsed = readParsedImportedRowPayload(
        row.rawPayload as Prisma.JsonValue
      );

      if (parsed?.balanceAfter == null) {
        continue;
      }

      candidates.push({
        importedBalanceWon: parsed.balanceAfter,
        referenceOccurredOn: parsed.occurredOn,
        referenceRowNumber: row.rowNumber
      });
    }

    candidates.sort(
      (left, right) =>
        left.referenceOccurredOn.localeCompare(right.referenceOccurredOn) ||
        left.referenceRowNumber - right.referenceRowNumber
    );

    return candidates[0] ?? null;
  }
}
