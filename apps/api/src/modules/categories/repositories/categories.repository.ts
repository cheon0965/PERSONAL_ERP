import { Injectable } from '@nestjs/common';
import type {
  CategoryKind,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@personal-erp/contracts';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../../common/utils/normalize-unique-key.util';

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
    input: CreateCategoryRequest & { defaultAccountSubjectId: string | null }
  ) {
    return this.prisma.category.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        kind: input.kind,
        defaultAccountSubjectId: input.defaultAccountSubjectId
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
        ...(input.defaultAccountSubjectId === undefined
          ? {}
          : { defaultAccountSubjectId: input.defaultAccountSubjectId }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
  }

  findEligibleAccountSubjectInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    categoryKind: Exclude<CategoryKind, 'TRANSFER'>;
    accountSubjectId?: string;
    accountSubjectCode?: string;
  }) {
    return this.prisma.accountSubject.findFirst({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        ...(input.accountSubjectId ? { id: input.accountSubjectId } : {}),
        ...(input.accountSubjectCode ? { code: input.accountSubjectCode } : {}),
        statementType: 'PROFIT_AND_LOSS',
        subjectKind: input.categoryKind,
        isSystem: true,
        isActive: true
      },
      select: {
        id: true
      }
    });
  }
}
