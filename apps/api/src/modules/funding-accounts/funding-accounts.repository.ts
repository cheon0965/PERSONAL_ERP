import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FundingAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        ledgerId,
        status: 'ACTIVE'
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }
}
