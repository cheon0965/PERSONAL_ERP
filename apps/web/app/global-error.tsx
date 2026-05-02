'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const diagnostics = [
    error.message ? `메시지 ${error.message}` : null,
    error.digest ? `오류 식별자 ${error.digest}` : null,
    error.stack ? `스택\n${error.stack}` : null
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');

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
            <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>
              서버 오류가 발생했습니다
            </h1>
            <p
              style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52606d' }}
            >
              페이지를 준비하는 중 문제가 발생했습니다. 잠시 후 다시 시도해
              주세요.
            </p>
            {diagnostics ? (
              <details
                style={{
                  marginTop: '1rem',
                  textAlign: 'left',
                  border: '1px solid #cbd2d9',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  background: '#fff'
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 700
                  }}
                >
                  개발자 진단 정보
                </summary>
                <pre
                  style={{
                    margin: '0.75rem 0 0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#52606d',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: '0.75rem'
                  }}
                >
                  {diagnostics}
                </pre>
              </details>
            ) : null}
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
