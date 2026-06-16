import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';

test('GET /collected-transactions returns 401 when the bearer token is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/collected-transactions');

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      'Missing bearer token'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.access_denied' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'missing_bearer_token'
      )
    );
  } finally {
    await context.close();
  }
});

test('GET /auth/me returns the authenticated user', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/me', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      currentWorkspace: {
        tenant: {
          id: 'tenant-1',
          slug: 'demo-tenant',
          name: 'Demo Workspace',
          status: 'ACTIVE'
        },
        membership: {
          id: 'membership-1',
          role: 'OWNER',
          status: 'ACTIVE'
        },
        ledger: {
          id: 'ledger-1',
          name: '사업 장부',
          baseCurrency: 'KRW',
          timezone: 'Asia/Seoul',
          status: 'ACTIVE'
        }
      }
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  } finally {
    await context.close();
  }
});
