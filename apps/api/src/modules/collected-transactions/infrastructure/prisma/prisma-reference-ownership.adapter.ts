import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ReferenceOwnershipPort } from '../../application/ports/reference-ownership.port';

@Injectable()
export class PrismaReferenceOwnershipAdapter
  implements ReferenceOwnershipPort
{
  constructor(private readonly prisma: PrismaService) {}

  async fundingAccountExistsForUser(
    userId: string,
    fundingAccountId: string
  ): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { id: fundingAccountId, userId },
      select: { id: true }
    });

    return Boolean(account);
  }

  async categoryExistsForUser(
    userId: string,
    categoryId?: string
  ): Promise<boolean> {
    if (!categoryId) {
      return true;
    }

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true }
    });

    return Boolean(category);
  }
}
