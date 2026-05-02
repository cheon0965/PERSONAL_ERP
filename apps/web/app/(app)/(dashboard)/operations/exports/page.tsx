import { OperationsExportsPage } from '@/features/operations/operations-exports-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '내보내기',
  description:
    '운영 결과와 보고 자료를 외부 검토용 파일로 내보내는 흐름을 확인합니다.'
});

export default function Page() {
  return <OperationsExportsPage />;
}
