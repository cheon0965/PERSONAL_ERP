import { AccountSettingsPage } from '@/features/settings/account-settings-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '세션',
  description:
    '현재 로그인 세션과 다른 기기 연결 상태를 확인하고 필요 시 종료합니다.'
});

export default function AccountSessionsSettingsRoutePage() {
  return <AccountSettingsPage section="sessions" />;
}
