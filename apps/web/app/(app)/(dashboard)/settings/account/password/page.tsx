import { AccountSettingsPage } from '@/features/settings/account-settings-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '비밀번호',
  description: '현재 비밀번호를 확인하고 새 비밀번호로 변경해 계정 보안을 관리합니다.'
});

export default function AccountPasswordSettingsRoutePage() {
  return <AccountSettingsPage section="password" />;
}
