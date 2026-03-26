import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK = 'false';

test('fetchJsonWithConfig returns parsed JSON when the API call succeeds', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  const result = await fetchJsonWithConfig(
    '/dashboard/summary',
    { fallback: true },
    {
      apiBaseUrl: 'http://localhost:4000/api',
      demoFallbackEnabled: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  );

  assert.deepEqual(result, { ok: true });
});

test('fetchJsonWithConfig returns fallback data when demo mode is explicitly enabled', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  const fallback = { source: 'fallback' };
  const originalWarn = console.warn;
  console.warn = () => undefined;

  try {
    const result = await fetchJsonWithConfig('/transactions', fallback, {
      apiBaseUrl: 'http://localhost:4000/api',
      demoFallbackEnabled: true,
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED');
      }
    });

    assert.deepEqual(result, fallback);
  } finally {
    console.warn = originalWarn;
  }
});

test('fetchJsonWithConfig throws a helpful error when demo mode is disabled', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  await assert.rejects(
    () =>
      fetchJsonWithConfig('/transactions', [], {
        apiBaseUrl: 'http://localhost:4000/api',
        demoFallbackEnabled: false,
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED');
        }
      }),
    /Demo fallback is disabled/
  );
});

test('buildRequestFailureMessage explains how to re-enable demo fallback locally', async () => {
  const { buildRequestFailureMessage } =
    await import('../src/shared/api/fetch-json');
  const message = buildRequestFailureMessage(
    '/transactions',
    new Error('Request failed: 500')
  );

  assert.match(message, /NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true/);
  assert.match(message, /Request failed for \/transactions/);
});
