import { redirect } from 'next/navigation';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '계정 설정',
  description: '내 계정의 기본 정보, 비밀번호, 세션, 보안 이벤트 화면으로 이동합니다.'
});

export default function AccountSettingsRoutePage() {
  redirect('/settings/account/profile');
}
