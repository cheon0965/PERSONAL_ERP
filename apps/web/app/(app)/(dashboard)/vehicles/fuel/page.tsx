import { VehiclesPage } from '@/features/vehicles/vehicles-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '주유 기록',
  description: '차량별 주유 금액, 주행 거리, 연료 사용 이력을 확인하고 운영 비용과 연결합니다.'
});

export default function VehiclesFuelPage() {
  return <VehiclesPage section="fuel" />;
}
