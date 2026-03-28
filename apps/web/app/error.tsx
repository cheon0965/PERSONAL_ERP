'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>500</p>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>Server error</h1>
        <p style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52606d' }}>
          Something went wrong while preparing this page. Please try again in a
          moment.
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
          Try again
        </button>
      </section>
    </main>
  );
}
