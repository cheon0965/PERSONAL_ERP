import { WorkspaceSettingsPage } from '@/features/settings/workspace-settings-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '사업장 설정',
  description: '사업장 이름, 슬러그, 기본 장부 연결 등 운영 기준이 되는 설정을 관리합니다.'
});

export default function WorkspaceSettingsRoutePage() {
  return <WorkspaceSettingsPage />;
}
