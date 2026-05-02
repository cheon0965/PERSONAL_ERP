import { redirect } from 'next/navigation';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '기준 데이터 관리',
  description: '자금수단, 카테고리, 공식 참조값 관리 화면으로 이동합니다.'
});

export default function ReferenceDataManageRoutePage() {
  redirect('/reference-data/funding-accounts');
}
