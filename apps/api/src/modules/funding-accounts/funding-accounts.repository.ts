import { Injectable } from '@nestjs/common';
import type {
  CreateFundingAccountRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';

@Injectable()
export class FundingAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(
    tenantId: string,
    ledgerId: string,
    input?: {
      includeInactive?: boolean;
    }
  ) {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        ledgerId,
        ...(input?.includeInactive ? {} : { status: 'ACTIVE' })
      },
      orderBy: input?.includeInactive
        ? [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
        : [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  findByIdInWorkspace(accountId: string, tenantId: string, ledgerId: string) {
    return this.prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId,
        ledgerId
      }
    });
  }

  async createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateFundingAccountRequest
  ) {
    const lastAccount = await this.prisma.account.findFirst({
      where: {
        tenantId,
        ledgerId
      },
      orderBy: {
        sortOrder: 'desc'
      },
      select: {
        sortOrder: true
      }
    });

    return this.prisma.account.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        type: input.type,
        sortOrder: (lastAccount?.sortOrder ?? -1) + 1
      }
    });
  }

  updateInWorkspace(
    accountId: string,
    input: UpdateFundingAccountRequest
  ) {
    return this.prisma.account.update({
      where: {
        id: accountId
      },
      data: {
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        ...(input.status === undefined ? {} : { status: input.status })
      }
    });
  }
}
