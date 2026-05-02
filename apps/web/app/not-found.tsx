import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '페이지를 찾을 수 없습니다',
  description: '요청한 PERSONAL ERP 페이지가 없거나 더 이상 제공되지 않는 경우 안내하는 화면입니다.'
});

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#f5f7f9',
        color: '#1f2933'
      }}
    >
      <section style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>404</p>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52606d' }}>
          요청하신 페이지가 없거나 더 이상 제공되지 않습니다.
        </p>
      </section>
    </main>
  );
}
