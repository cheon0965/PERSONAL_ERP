import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchBalanceDiscrepancy,
  ImportBatchItem
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { readWorkspaceFundingAccountLiveBalances } from '../funding-accounts/funding-account-live-balance.reader';
import {
  importBatchRecordInclude,
  mapImportBatchRecordToItem
} from './import-batch.mapper';
import { readParsedImportedRowPayload } from './import-batch.policy';

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

    const item = mapImportBatchRecordToItem(batch);

    // 은행 명세 마지막 행의 거래후잔액과 ERP 장부 잔액을 비교한다.
    if (batch.fundingAccountId) {
      const discrepancy = await this.computeBalanceDiscrepancy({
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        fundingAccountId: batch.fundingAccountId,
        rows: batch.rows
      });

      if (discrepancy) {
        item.balanceDiscrepancy = discrepancy;
      }
    }

    return item;
  }

  /**
   * 배치의 마지막 파싱된 행에서 거래후잔액을 읽고,
   * 해당 자금수단의 현재 ERP 장부 잔액과 비교한다.
   * 차이가 있으면 경고 정보를 반환한다.
   */
  private async computeBalanceDiscrepancy(input: {
    tenantId: string;
    ledgerId: string;
    fundingAccountId: string;
    rows: Array<{ rawPayload: unknown; parseStatus: string; rowNumber: number }>;
  }): Promise<ImportBatchBalanceDiscrepancy | null> {
    // 파싱된 행을 역순으로 탐색하여 마지막 balanceAfter를 찾는다.
    const parsedRows = input.rows
      .filter((row) => row.parseStatus === 'PARSED')
      .sort((a, b) => b.rowNumber - a.rowNumber);

    let importedBalanceWon: number | null = null;

    for (const row of parsedRows) {
      const parsed = readParsedImportedRowPayload(
        row.rawPayload as unknown as import('@prisma/client').Prisma.JsonValue
      );

      if (parsed?.balanceAfter != null) {
        importedBalanceWon = parsed.balanceAfter;
        break;
      }
    }

    if (importedBalanceWon == null) {
      return null;
    }

    // ERP 장부 잔액 조회
    const accounts = await readWorkspaceFundingAccountLiveBalances(
      this.prisma,
      {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId
      },
      { includeInactive: true }
    );

    const targetAccount = accounts.find(
      (account) => account.id === input.fundingAccountId
    );

    if (!targetAccount) {
      return null;
    }

    const ledgerBalanceWon = targetAccount.balanceWon;
    const differenceWon = subtractMoneyWon(importedBalanceWon, ledgerBalanceWon);

    // 차이가 없으면 경고 불필요
    if (differenceWon === 0) {
      return null;
    }

    return {
      importedBalanceWon,
      ledgerBalanceWon,
      differenceWon
    };
  }
}
