import { ReferenceDataManagementPage } from '@/features/reference-data/reference-data-management-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '카테고리',
  description:
    '수입·지출 분류와 활성 상태를 관리해 거래 검토와 보고 기준을 정리합니다.'
});

export default function CategoriesRoutePage() {
  return <ReferenceDataManagementPage section="categories" />;
}
