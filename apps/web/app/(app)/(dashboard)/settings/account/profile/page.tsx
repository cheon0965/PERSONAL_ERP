import { AccountSettingsPage } from '@/features/settings/account-settings-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '기본 정보',
  description:
    '내 계정 이름과 이메일 등 기본 프로필 정보를 확인하고 관리합니다.'
});

export default function AccountProfileSettingsRoutePage() {
  return <AccountSettingsPage section="profile" />;
}
