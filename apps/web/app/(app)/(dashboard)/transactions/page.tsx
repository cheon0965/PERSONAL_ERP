import { TransactionsPage } from '@/features/transactions/transactions-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '수집 거래',
  description:
    '은행·카드 업로드와 수동 입력으로 모은 거래를 검토하고 전표 처리 흐름으로 연결합니다.'
});

export default function Page() {
  return <TransactionsPage />;
}
