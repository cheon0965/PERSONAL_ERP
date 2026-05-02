import { VehiclesPage } from '@/features/vehicles/vehicles-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '차량 운영',
  description: '차량 목록, 주유, 정비 이력을 한 흐름으로 확인하는 차량 운영 시작 화면입니다.'
});

export default function Page() {
  return <VehiclesPage section="overview" />;
}
