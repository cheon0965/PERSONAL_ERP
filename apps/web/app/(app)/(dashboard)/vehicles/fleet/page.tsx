import { VehiclesPage } from '@/features/vehicles/vehicles-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '차량 관리',
  description: '업무용 차량의 기본 정보, 사용 상태, 운영 기준을 관리합니다.'
});

export default function VehiclesFleetPage() {
  return <VehiclesPage section="fleet" />;
}
