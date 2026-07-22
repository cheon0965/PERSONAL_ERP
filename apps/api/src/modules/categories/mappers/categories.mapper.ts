import type { CategoryItem } from '@personal-erp/contracts';

type CategoryRecord = Pick<
  CategoryItem,
  'id' | 'name' | 'kind' | 'defaultAccountSubjectId' | 'isActive'
>;

export function mapCategoryToItem(category: CategoryRecord): CategoryItem {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    defaultAccountSubjectId: category.defaultAccountSubjectId,
    isActive: category.isActive
  };
}
