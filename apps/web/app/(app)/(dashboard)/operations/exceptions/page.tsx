import { OperationsExceptionsPage } from '@/features/operations/operations-exceptions-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '예외 처리함',
  description:
    '미확정 거래, 실패 행, 월 마감 차단 사유를 모아 해결 순서를 확인합니다.'
});

export default function OperationsExceptionsRoutePage() {
  return <OperationsExceptionsPage />;
}
