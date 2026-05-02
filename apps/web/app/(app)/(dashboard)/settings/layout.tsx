import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '현재 사업장 / 장부',
  description:
    '현재 로그인 사용자의 사업장, 권한, 장부 기준을 확인하는 설정 시작 화면입니다.'
});

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
