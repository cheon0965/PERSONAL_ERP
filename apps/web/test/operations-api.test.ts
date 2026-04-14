import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK = 'false';

test('operations API helpers call protected operations endpoints', async () => {
  const capturedRequests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    capturedRequests.push(
      `${init?.method ?? 'GET'} ${String(input)} ${headers.get('Authorization')}`
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const { setStoredAccessToken, clearStoredAccessToken } =
      await import('../src/shared/auth/auth-session-store');
    const {
      getOperationsAlerts,
      getOperationsChecklist,
      getOperationsExceptions,
      getOperationsExports,
      getOperationsImportStatus,
      getOperationsMonthEnd,
      getOperationsNotes,
      getOperationsSummary,
      getOperationsSystemStatus,
      runOperationsExport,
      createOperationsNote
    } = await import('../src/features/operations/operations.api');

    setStoredAccessToken('token-operations');

    assert.deepEqual(await getOperationsSummary(), { ok: true });
    assert.deepEqual(await getOperationsChecklist(), { ok: true });
    assert.deepEqual(await getOperationsExceptions(), { ok: true });
    assert.deepEqual(await getOperationsMonthEnd(), { ok: true });
    assert.deepEqual(await getOperationsImportStatus(), { ok: true });
    assert.deepEqual(await getOperationsSystemStatus(), { ok: true });
    assert.deepEqual(await getOperationsAlerts(), { ok: true });
    assert.deepEqual(await getOperationsExports(), { ok: true });
    assert.deepEqual(
      await runOperationsExport({ scope: 'COLLECTED_TRANSACTIONS' }),
      { ok: true }
    );
    assert.deepEqual(await getOperationsNotes(), { ok: true });
    assert.deepEqual(
      await createOperationsNote({
        kind: 'GENERAL',
        title: '인수인계',
        body: '확인 필요',
        relatedHref: null,
        periodId: null
      }),
      { ok: true }
    );
    assert.deepEqual(capturedRequests, [
      'GET http://localhost:4000/api/operations/summary Bearer token-operations',
      'GET http://localhost:4000/api/operations/checklist Bearer token-operations',
      'GET http://localhost:4000/api/operations/exceptions Bearer token-operations',
      'GET http://localhost:4000/api/operations/month-end Bearer token-operations',
      'GET http://localhost:4000/api/operations/import-status Bearer token-operations',
      'GET http://localhost:4000/api/operations/system-status Bearer token-operations',
      'GET http://localhost:4000/api/operations/alerts Bearer token-operations',
      'GET http://localhost:4000/api/operations/exports Bearer token-operations',
      'POST http://localhost:4000/api/operations/exports Bearer token-operations',
      'GET http://localhost:4000/api/operations/notes Bearer token-operations',
      'POST http://localhost:4000/api/operations/notes Bearer token-operations'
    ]);

    clearStoredAccessToken();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
