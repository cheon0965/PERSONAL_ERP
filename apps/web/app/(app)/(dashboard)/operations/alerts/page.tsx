import { OperationsAlertsPage } from '@/features/operations/operations-alerts-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '알림 / 이벤트 센터',
  description:
    '운영 중 확인해야 할 알림, 이벤트, 후속 조치 항목을 한곳에서 점검합니다.'
});

export default function OperationsAlertsRoutePage() {
  return <OperationsAlertsPage />;
}
