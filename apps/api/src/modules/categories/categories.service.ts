import { Injectable } from '@nestjs/common';
import type { CategoryItem } from '@personal-erp/contracts';
import { mapCategoryToItem } from './categories.mapper';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(userId: string): Promise<CategoryItem[]> {
    const categories = await this.categoriesRepository.findAllByUserId(userId);
    return categories.map(mapCategoryToItem);
  }
}
