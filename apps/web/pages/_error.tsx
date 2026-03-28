import type { NextPageContext } from 'next';

type ErrorPageProps = {
  statusCode: number;
};

function readStatusCode(propsStatusCode?: number, responseStatusCode?: number): number {
  if (typeof propsStatusCode === 'number') {
    return propsStatusCode;
  }

  if (typeof responseStatusCode === 'number') {
    return responseStatusCode;
  }

  return 500;
}

export default function ErrorPage({ statusCode }: ErrorPageProps) {
  const title = statusCode === 404 ? 'Page not found' : 'Server error';
  const description =
    statusCode === 404
      ? 'The page you requested does not exist or is no longer available.'
      : 'Something went wrong while preparing this page. Please try again in a moment.';

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
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>
          {statusCode}
        </p>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>{title}</h1>
        <p style={{ margin: '1rem 0 0', lineHeight: 1.6, color: '#52606d' }}>
          {description}
        </p>
      </section>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => ({
  statusCode: readStatusCode(err?.statusCode, res?.statusCode)
});
