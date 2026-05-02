import { ImportsPage } from '@/features/imports/imports-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '업로드 배치',
  description: '은행·카드 명세 파일을 업로드하고 수집 거래로 변환할 배치 목록을 관리합니다.'
});

export default function ImportsRoute() {
  return <ImportsPage mode="list" />;
}
