import { OperationsHomePage } from '@/features/operations/operations-home-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '운영 허브',
  description: '월 마감, 예외, 업로드, 내보내기, 시스템 상태를 운영 업무 흐름별로 확인합니다.'
});

export default function OperationsRoutePage() {
  return <OperationsHomePage />;
}
