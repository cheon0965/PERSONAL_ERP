import { ReferenceDataManagementPage } from '@/features/reference-data/reference-data-management-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '공식 참조값',
  description: '시스템에서 사용하는 공식 참조 데이터와 조회 기준을 확인합니다.'
});

export default function ReferenceDataLookupsRoutePage() {
  return <ReferenceDataManagementPage section="lookups" />;
}
