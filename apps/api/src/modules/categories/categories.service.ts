import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CategoryItem,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapCategoryToItem } from './categories.mapper';
import { CategoriesRepository } from './categories.repository';

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
        kind: input.kind
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
        candidate.name.trim().toLowerCase() ===
          input.normalizedName.toLowerCase()
    );

    if (duplicate) {
      throw new ConflictException(
        duplicate.isActive
          ? '같은 구분에 동일한 카테고리 이름이 이미 있습니다.'
          : '같은 구분에 같은 이름의 비활성 카테고리가 있습니다. 기존 카테고리를 다시 활성화하거나 다른 이름을 사용해 주세요.'
      );
    }
  }
}

function normalizeCategoryName(name: string) {
  const normalized = name.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('카테고리 이름을 입력해 주세요.');
  }

  return normalized;
}
