import { AccountSettingsPage } from '@/features/settings/account-settings-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '보안 이벤트',
  description: '내 계정의 최근 보안 관련 이력과 로그인 활동 흔적을 확인합니다.'
});

export default function AccountEventsSettingsRoutePage() {
  return <AccountSettingsPage section="events" />;
}
