import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CategoryItem,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../common/auth/required-workspace.util';
import { readGenericAccountSubjectCode } from '../../../common/prisma/standard-account-subject.catalog';
import { normalizeCaseInsensitiveText } from '../../../common/utils/normalize-unique-key.util';
import { mapCategoryToItem } from '../mappers/categories.mapper';
import { CategoriesRepository } from '../repositories/categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(
    user: AuthenticatedUser,
    input?: {
      includeInactive?: boolean;
    }
  ): Promise<CategoryItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const categories = await this.categoriesRepository.findAllInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      input
    );
    return categories.map(mapCategoryToItem);
  }

  async create(
    user: AuthenticatedUser,
    input: CreateCategoryRequest
  ): Promise<CategoryItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalizedName = normalizeCategoryName(input.name);
    const defaultAccountSubjectId = await this.resolveDefaultAccountSubjectId({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      categoryKind: input.kind,
      requestedAccountSubjectId: input.defaultAccountSubjectId
    });

    await this.assertNoDuplicateCategory({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      kind: input.kind,
      normalizedName
    });

    const created = await this.categoriesRepository.createInWorkspace(
      workspace.userId,
      workspace.tenantId,
      workspace.ledgerId,
      {
        name: normalizedName,
        kind: input.kind,
        defaultAccountSubjectId
      }
    );

    return mapCategoryToItem(created);
  }

  async update(
    user: AuthenticatedUser,
    categoryId: string,
    input: UpdateCategoryRequest
  ): Promise<CategoryItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.categoriesRepository.findByIdInWorkspace(
      categoryId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    const normalizedName = normalizeCategoryName(input.name);
    const defaultAccountSubjectId =
      input.defaultAccountSubjectId === undefined
        ? undefined
        : await this.resolveDefaultAccountSubjectId({
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            categoryKind: existing.kind,
            requestedAccountSubjectId: input.defaultAccountSubjectId
          });

    await this.assertNoDuplicateCategory({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      kind: existing.kind,
      normalizedName,
      excludeCategoryId: existing.id
    });

    const updated = await this.categoriesRepository.updateInWorkspace(
      categoryId,
      {
        name: normalizedName,
        defaultAccountSubjectId,
        isActive: input.isActive
      }
    );

    return mapCategoryToItem(updated);
  }

  private async assertNoDuplicateCategory(input: {
    tenantId: string;
    ledgerId: string;
    kind: CategoryItem['kind'];
    normalizedName: string;
    excludeCategoryId?: string;
  }) {
    const categories = await this.categoriesRepository.findAllInWorkspace(
      input.tenantId,
      input.ledgerId,
      {
        includeInactive: true
      }
    );
    const duplicate = categories.find(
      (candidate) =>
        candidate.kind === input.kind &&
        candidate.id !== input.excludeCategoryId &&
        normalizeCaseInsensitiveText(candidate.name) ===
          normalizeCaseInsensitiveText(input.normalizedName)
    );

    if (duplicate) {
      throw new ConflictException(
        duplicate.isActive
          ? '같은 구분에 동일한 카테고리 이름이 이미 있습니다.'
          : '같은 구분에 같은 이름의 비활성 카테고리가 있습니다. 기존 카테고리를 다시 활성화하거나 다른 이름을 사용해 주세요.'
      );
    }
  }

  private async resolveDefaultAccountSubjectId(input: {
    tenantId: string;
    ledgerId: string;
    categoryKind: CategoryItem['kind'];
    requestedAccountSubjectId?: string | null;
  }): Promise<string | null> {
    const requestedAccountSubjectId =
      input.requestedAccountSubjectId?.trim() || null;

    if (input.categoryKind === 'TRANSFER') {
      if (requestedAccountSubjectId) {
        throw new BadRequestException(
          '이체 카테고리에는 기본 손익 계정과목을 연결할 수 없습니다.'
        );
      }

      return null;
    }

    const genericCode = readGenericAccountSubjectCode(input.categoryKind);
    const accountSubject =
      await this.categoriesRepository.findEligibleAccountSubjectInWorkspace({
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        categoryKind: input.categoryKind,
        ...(requestedAccountSubjectId
          ? { accountSubjectId: requestedAccountSubjectId }
          : { accountSubjectCode: genericCode ?? undefined })
      });

    if (!accountSubject) {
      throw new BadRequestException(
        requestedAccountSubjectId
          ? '기본 계정과목은 현재 장부의 활성 시스템 손익 계정과목이어야 하며 카테고리 구분과 일치해야 합니다.'
          : '카테고리에 연결할 기본 시스템 계정과목이 준비되지 않았습니다.'
      );
    }

    return accountSubject.id;
  }
}

function normalizeCategoryName(name: string) {
  const normalized = name.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('카테고리 이름을 입력해 주세요.');
  }

  return normalized;
}
