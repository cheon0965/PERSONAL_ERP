import { OperationsNotesPage } from '@/features/operations/operations-notes-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '운영 메모',
  description: '월 운영 중 남겨야 할 인수인계, 예외, 마감 관련 메모를 정리합니다.'
});

export default function Page() {
  return <OperationsNotesPage />;
}
