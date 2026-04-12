import { Injectable } from '@nestjs/common';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@personal-erp/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(
    tenantId: string,
    ledgerId: string,
    input?: {
      includeInactive?: boolean;
    }
  ) {
    return this.prisma.category.findMany({
      where: {
        tenantId,
        ledgerId,
        ...(input?.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ isActive: 'desc' }, { kind: 'asc' }, { name: 'asc' }]
    });
  }

  findByIdInWorkspace(categoryId: string, tenantId: string, ledgerId: string) {
    return this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
        ledgerId
      }
    });
  }

  createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateCategoryRequest
  ) {
    return this.prisma.category.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        kind: input.kind
      }
    });
  }

  updateInWorkspace(categoryId: string, input: UpdateCategoryRequest) {
    return this.prisma.category.update({
      where: {
        id: categoryId
      },
      data: {
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
  }
}
