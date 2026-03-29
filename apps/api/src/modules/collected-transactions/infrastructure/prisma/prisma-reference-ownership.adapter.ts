import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ReferenceOwnershipPort } from '../../application/ports/reference-ownership.port';

@Injectable()
export class PrismaReferenceOwnershipAdapter
  implements ReferenceOwnershipPort
{
  constructor(private readonly prisma: PrismaService) {}

  async fundingAccountExistsInWorkspace(
    tenantId: string,
    ledgerId: string,
    fundingAccountId: string
  ): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { id: fundingAccountId, tenantId, ledgerId },
      select: { id: true }
    });

    return Boolean(account);
  }

  async categoryExistsInWorkspace(
    tenantId: string,
    ledgerId: string,
    categoryId?: string
  ): Promise<boolean> {
    if (!categoryId) {
      return true;
    }

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, ledgerId },
      select: { id: true }
    });

    return Boolean(category);
  }
}
