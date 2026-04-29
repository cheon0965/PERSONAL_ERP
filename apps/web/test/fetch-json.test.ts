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
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');

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
      error instanceof ApiRequestError &&
      error.status === 0 &&
      error.errorCode === 'NETWORK_REQUEST_FAILED' &&
      error.path === '/collected-transactions' &&
      error.technicalMessage?.includes('/collected-transactions') === true
  );
});

test('fetchJsonWithConfig throws a helpful error when demo mode is disabled', async () => {
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');
  await assert.rejects(
    () =>
      fetchJsonWithConfig('/collected-transactions', [], {
        apiBaseUrl: 'http://localhost:4000/api',
        demoFallbackEnabled: false,
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED');
        }
      }),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.userMessage.includes('서버와 연결하지 못했습니다') &&
      error.errorCode === 'NETWORK_REQUEST_FAILED' &&
      error.technicalMessage?.includes('데모 폴백이 비활성화되어 있습니다') ===
        true
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
      error.userMessage === '로그인이 만료되었습니다. 다시 로그인해 주세요.' &&
      error.errorCode === 'AUTH_REQUIRED' &&
      error.technicalMessage === 'Invalid access token'
  );

  assert.equal(unauthorizedCalls, 1);
});

test('fetchJsonWithConfig translates developer-oriented API messages and keeps diagnostics', async () => {
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/collected-transactions',
        [],
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: false,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({ message: 'Funding account not found' }),
              {
                status: 404,
                headers: {
                  'Content-Type': 'application/json',
                  'x-request-id': 'request-helpful-1'
                }
              }
            )
        },
        { allowDemoFallback: false }
      ),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.userMessage ===
        '선택한 자금수단을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.' &&
      error.errorCode === 'RESOURCE_NOT_FOUND' &&
      error.requestId === 'request-helpful-1' &&
      error.technicalMessage === 'Funding account not found'
  );
});

test('buildErrorFeedback separates user guidance from diagnostics', async () => {
  const { ApiRequestError, buildErrorFeedback } =
    await import('../src/shared/api/fetch-json');

  const error = new ApiRequestError(
    409,
    '현재 데이터 상태와 맞지 않아 작업을 완료하지 못했습니다.',
    { message: 'Journal entry changed during correction. Please retry.' },
    {
      path: '/journal-entries/entry-1/corrections',
      requestId: 'request-correction-1',
      errorCode: 'BUSINESS_RULE_CONFLICT',
      technicalMessage: 'Journal entry changed during correction. Please retry.'
    }
  );
  const feedback = buildErrorFeedback(error, '작업을 완료하지 못했습니다.');

  assert.deepEqual(feedback, {
    severity: 'error',
    message: '현재 데이터 상태와 맞지 않아 작업을 완료하지 못했습니다.',
    diagnostics:
      'HTTP 409 · 오류 코드 BUSINESS_RULE_CONFLICT · 요청번호 request-correction-1 · 경로 /journal-entries/entry-1/corrections'
  });
  assert.match(error.message, /진단:/);
  assert.doesNotMatch(feedback.message, /진단:/);
});

test('fetchJsonWithConfig translates permission policy messages and preserves the raw clue', async () => {
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/workspace/settings',
        { ok: false },
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: false,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                message:
                  'Only owners and managers can update workspace settings.',
                requestId: 'request-policy-1'
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              }
            )
        },
        { allowDemoFallback: false }
      ),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.userMessage ===
        '현재 권한으로는 이 작업을 진행할 수 없습니다. 필요한 역할 권한을 확인해 주세요.' &&
      error.errorCode === 'ACCESS_DENIED' &&
      error.requestId === 'request-policy-1' &&
      error.technicalMessage ===
        'Only owners and managers can update workspace settings.'
  );
});

test('fetchJsonWithConfig translates domain resource names with natural Korean particles', async () => {
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/journal-entries',
        [],
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: false,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({ message: 'Original journal entry not found.' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              }
            )
        },
        { allowDemoFallback: false }
      ),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.userMessage ===
        '선택한 원본 전표를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.'
  );
});

test('fetchJsonWithConfig turns validator messages into user guidance', async () => {
  const { ApiRequestError, fetchJsonWithConfig } =
    await import('../src/shared/api/fetch-json');

  await assert.rejects(
    () =>
      fetchJsonWithConfig(
        '/auth/login',
        { ok: false },
        {
          apiBaseUrl: 'http://localhost:4000/api',
          demoFallbackEnabled: false,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                message: ['email must be an email', 'password must be a string']
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              }
            )
        },
        { allowDemoFallback: false }
      ),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.userMessage ===
        '입력값을 확인해 주세요. 이메일 형식이 올바르지 않습니다. 비밀번호 항목을 입력해 주세요.' &&
      error.errorCode === 'REQUEST_INVALID'
  );
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
