import { VehiclesPage } from '@/features/vehicles/vehicles-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '정비 이력',
  description: '차량별 정비 내역, 비용, 다음 점검 기준을 기록하고 확인합니다.'
});

export default function VehiclesMaintenancePage() {
  return <VehiclesPage section="maintenance" />;
}
