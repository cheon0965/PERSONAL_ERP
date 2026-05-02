import { ReferenceDataPage } from '@/features/reference-data/reference-data-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '기준 데이터 준비 상태',
  description:
    '월 운영 전에 필요한 자금수단, 카테고리, 공식 참조값의 준비 상태를 점검합니다.'
});

export default function Page() {
  return <ReferenceDataPage />;
}
