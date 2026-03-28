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
    const result = await fetchJsonWithConfig(
      '/collected-transactions',
      fallback,
      {
        apiBaseUrl: 'http://localhost:4000/api',
        demoFallbackEnabled: true,
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED');
        }
      },
      { allowDemoFallback: true }
    );

    assert.deepEqual(result, fallback);
  } finally {
    console.warn = originalWarn;
  }
});

test('fetchJsonWithConfig does not fabricate mutation success from demo fallback', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/collected-transactions',
        { id: 'fallback' },
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: true,
          fetchImpl: async () => {
            throw new Error('connect ECONNREFUSED');
          }
        },
        {
          method: 'POST',
          body: { title: 'Fuel refill' }
        }
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('/collected-transactions')
  );
});

test('fetchJsonWithConfig throws a helpful error when demo mode is disabled', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  await assert.rejects(
    () =>
      fetchJsonWithConfig('/collected-transactions', [], {
        apiBaseUrl: 'http://localhost:4000/api',
        demoFallbackEnabled: false,
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED');
        }
      }),
    /데모 폴백이 비활성화되어 있습니다/
  );
});

test('fetchJsonWithConfig injects the bearer token for protected requests', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  let capturedAuthorization: string | null = null;
  let capturedCredentials: RequestCredentials | undefined;

  const result = await fetchJsonWithConfig(
    '/dashboard/summary',
    { ok: false },
    {
      apiBaseUrl: 'http://localhost:4000/api',
      demoFallbackEnabled: false,
      getAccessToken: () => 'token-123',
      onUnauthorized: () => undefined,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        capturedAuthorization = headers.get('Authorization');
        capturedCredentials = init?.credentials;

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    { requireAuth: true }
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(capturedAuthorization, 'Bearer token-123');
  assert.equal(capturedCredentials, 'include');
});

test('fetchJsonWithConfig serializes JSON bodies for mutation requests', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  let capturedMethod: string | undefined;
  let capturedContentType: string | null = null;
  let capturedBody: string | undefined;

  const result = await fetchJsonWithConfig(
    '/collected-transactions',
    { id: 'fallback' },
    {
      apiBaseUrl: 'http://localhost:4000/api',
      demoFallbackEnabled: false,
      getAccessToken: () => 'token-123',
      onUnauthorized: () => undefined,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        capturedMethod = init?.method;
        capturedContentType = headers.get('Content-Type');
        capturedBody = typeof init?.body === 'string' ? init.body : undefined;

        return new Response(JSON.stringify({ id: 'txn-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    {
      requireAuth: true,
      method: 'POST',
      body: {
        title: 'Fuel refill',
        amountWon: 84000
      }
    }
  );

  assert.deepEqual(result, { id: 'txn-1' });
  assert.equal(capturedMethod, 'POST');
  assert.equal(capturedContentType, 'application/json');
  assert.deepEqual(JSON.parse(capturedBody ?? '{}'), {
    title: 'Fuel refill',
    amountWon: 84000
  });
});

test('fetchJsonWithConfig clears the session on 401 instead of falling back', async () => {
  const { UnauthorizedRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');
  let unauthorizedCalls = 0;

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/collected-transactions',
        [{ id: 'fallback' }],
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: true,
          getAccessToken: () => 'token-123',
          onUnauthorized: () => {
            unauthorizedCalls += 1;
          },
          fetchImpl: async () =>
            new Response(JSON.stringify({ message: 'Invalid access token' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            })
        },
        { requireAuth: true }
      ),
    (error: unknown) =>
      error instanceof UnauthorizedRequestError &&
      error.message === 'Invalid access token'
  );

  assert.equal(unauthorizedCalls, 1);
});

test('fetchJsonWithConfig retries once after refreshing the access token', async () => {
  const { fetchJsonWithConfig } = await import('../src/shared/api/fetch-json');
  const authorizationHeaders: Array<string | null> = [];
  let accessToken = 'expired-token';
  let refreshCalls = 0;

  const result = await fetchJsonWithConfig(
    '/collected-transactions',
    [],
    {
      apiBaseUrl: 'http://localhost:4000/api',
      demoFallbackEnabled: false,
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        refreshCalls += 1;
        accessToken = 'refreshed-token';
        return accessToken;
      },
      onUnauthorized: () => undefined,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        authorizationHeaders.push(headers.get('Authorization'));

        if (authorizationHeaders.length === 1) {
          return new Response(JSON.stringify({ message: 'Expired token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify([{ id: 'txn-1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    { requireAuth: true }
  );

  assert.deepEqual(result, [{ id: 'txn-1' }]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizationHeaders, [
    'Bearer expired-token',
    'Bearer refreshed-token'
  ]);
});

test('buildRequestFailureMessage explains how to re-enable demo fallback locally', async () => {
  const { buildRequestFailureMessage } =
    await import('../src/shared/api/fetch-json');
  const message = buildRequestFailureMessage(
    '/collected-transactions',
    new Error('Request failed: 500')
  );

  assert.match(message, /NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true/);
  assert.match(message, /\/collected-transactions 요청에 실패했습니다/);
});
