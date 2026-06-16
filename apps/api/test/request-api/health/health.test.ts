import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';

test('GET /health echoes an incoming x-request-id header', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health', {
      headers: {
        'x-request-id': 'manual-request-id-123'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'manual-request-id-123');
    assert.equal((response.body as { status: string }).status, 'ok');
  } finally {
    await context.close();
  }
});

test('GET /health applies the browser boundary headers for allowed origins', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health', {
      headers: {
        origin: 'http://localhost:3000'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:3000'
    );
    assert.equal(
      response.headers.get('access-control-allow-credentials'),
      'true'
    );
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      response.headers.get('permissions-policy'),
      'camera=(), geolocation=(), microphone=()'
    );
    assert.equal(
      response.headers.get('cross-origin-opener-policy'),
      'same-origin'
    );
    assert.equal(
      response.headers.get('cross-origin-resource-policy'),
      'same-site'
    );
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /default-src 'none'/
    );
    assert.equal(response.headers.get('strict-transport-security'), null);
  } finally {
    await context.close();
  }
});

test('GET /health/ready reports database readiness when Prisma is reachable', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/health/ready');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id') ?? '', /.+/);
    assert.deepEqual(response.body, {
      status: 'ready',
      timestamp: (response.body as { timestamp: string }).timestamp,
      checks: {
        database: 'ok'
      }
    });
  } finally {
    await context.close();
  }
});

test('GET /health/ready returns 503 and logs a readiness failure when Prisma is unreachable', async () => {
  const context = await createRequestTestContext();
  context.state.databaseReady = false;

  try {
    const response = await context.request('/health/ready');

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      status: 'not_ready',
      timestamp: (response.body as { timestamp: string }).timestamp,
      checks: {
        database: 'error'
      }
    });
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'error' &&
          candidate.event === 'system.readiness_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.check === 'database'
      )
    );
  } finally {
    await context.close();
  }
});
