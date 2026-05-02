import { LiabilitiesPage } from '@/features/liabilities/liabilities-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '부채 / 약정',
  description:
    '차입, 할부, 리스 같은 약정 정보를 관리하고 상환·잔액 흐름을 확인합니다.'
});

export default function LiabilitiesRoute() {
  return <LiabilitiesPage mode="list" />;
}
