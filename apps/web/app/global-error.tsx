'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
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
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>500</p>
            <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>
              서버 오류가 발생했습니다
            </h1>
            <p style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52606d' }}>
              {error.message || '페이지를 준비하는 중 문제가 발생했습니다.'}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                padding: '0.5rem 1.25rem',
                border: '1px solid #cbd2d9',
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              다시 시도
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
