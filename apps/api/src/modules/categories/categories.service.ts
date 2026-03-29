import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, CategoryItem } from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapCategoryToItem } from './categories.mapper';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(user: AuthenticatedUser): Promise<CategoryItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const categories = await this.categoriesRepository.findAllInWorkspace(
      workspace.tenantId,
      workspace.ledgerId
    );
    return categories.map(mapCategoryToItem);
  }
}
