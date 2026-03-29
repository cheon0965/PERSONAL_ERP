import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  LedgerTransactionTypeItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapLedgerTransactionTypeRecordToItem } from './ledger-transaction-type.mapper';

@Injectable()
export class LedgerTransactionTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser): Promise<LedgerTransactionTypeItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const ledgerTransactionTypes =
      await this.prisma.ledgerTransactionType.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
      });

    return ledgerTransactionTypes.map(mapLedgerTransactionTypeRecordToItem);
  }
}
