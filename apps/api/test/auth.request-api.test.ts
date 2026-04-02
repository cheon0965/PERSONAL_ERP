import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequestTestContext,
  readCookieValue,
  readSetCookieHeader
} from './request-api.test-support';
test('POST /auth/login returns access token and a refresh cookie for valid credentials', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id') ?? '', /.+/);
    assert.match(
      (response.body as { accessToken: string }).accessToken,
      /^test-access-token:[^:]+:user-1$/
    );
    assert.deepEqual((response.body as { user: unknown }).user, {
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
    assert.match(readSetCookieHeader(response.headers), /refreshToken=/);
    assert.match(readSetCookieHeader(response.headers), /HttpOnly/i);
    assert.match(readSetCookieHeader(response.headers), /SameSite=Strict/i);
    assert.match(readSetCookieHeader(response.headers), /Path=\/api\/auth/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.login_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh rotates the refresh session and returns a new access token', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const originalRefreshToken = readCookieValue(
      loginResponse.headers,
      'refreshToken'
    );

    assert.ok(originalRefreshToken);

    const response = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });

    const rotatedRefreshToken = readCookieValue(
      response.headers,
      'refreshToken'
    );
    assert.equal(response.status, 200);
    assert.ok(rotatedRefreshToken);
    assert.notEqual(rotatedRefreshToken, originalRefreshToken);
    assert.match(
      (response.body as { accessToken: string }).accessToken,
      /^test-access-token:[^:]+:user-1$/
    );

    const activeSessions = context.state.authSessions.filter(
      (candidate) =>
        candidate.userId === 'user-1' && candidate.revokedAt === null
    );
    const revokedSessions = context.state.authSessions.filter(
      (candidate) =>
        candidate.userId === 'user-1' && candidate.revokedAt !== null
    );
    assert.equal(activeSessions.length, 2);
    assert.equal(revokedSessions.length, 1);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.refresh_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh returns 401 when the refresh cookie is missing', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/refresh', {
      method: 'POST'
    });

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      'Missing refresh token'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.refresh_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'missing_refresh_token'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/logout revokes the current refresh session and clears the cookie', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const refreshToken = readCookieValue(loginResponse.headers, 'refreshToken');
    assert.ok(refreshToken);

    const logoutResponse = await context.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${refreshToken}`
      }
    });

    assert.equal(logoutResponse.status, 200);
    assert.equal(
      (logoutResponse.body as { status: string }).status,
      'logged_out'
    );
    assert.match(readSetCookieHeader(logoutResponse.headers), /refreshToken=/);

    const refreshResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${refreshToken}`
      }
    });

    assert.equal(refreshResponse.status, 401);
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.logout_succeeded' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/refresh revokes all active sessions when a rotated refresh token is reused', async () => {
  const context = await createRequestTestContext();

  try {
    const loginResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    const originalRefreshToken = readCookieValue(
      loginResponse.headers,
      'refreshToken'
    );
    assert.ok(originalRefreshToken);

    const rotatedResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });
    assert.equal(rotatedResponse.status, 200);

    const reuseResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `refreshToken=${originalRefreshToken}`
      }
    });

    assert.equal(reuseResponse.status, 401);
    assert.equal(
      context.state.authSessions.some(
        (candidate) =>
          candidate.userId === 'user-1' && candidate.revokedAt === null
      ),
      false
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.refresh_reuse_detected' &&
          candidate.details.userId === 'user-1'
      )
    );
  } finally {
    await context.close();
  }
});

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

test('POST /auth/login returns 401 for invalid credentials', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'WrongPassword!'
      }
    });

    assert.equal(response.status, 401);
    assert.equal(
      (response.body as { message: string }).message,
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.login_failed' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'invalid_credentials'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/login returns 403 for disallowed browser origins', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://evil.example.com',
        referer: 'http://evil.example.com/login'
      },
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      (response.body as { message: string }).message,
      'Origin not allowed'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.browser_origin_blocked' &&
          candidate.details.requestId ===
            response.headers.get('x-request-id') &&
          candidate.details.reason === 'origin_not_allowed'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/login returns 429 after too many invalid attempts from the same client', async () => {
  const context = await createRequestTestContext();

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await context.request('/auth/login', {
        method: 'POST',
        body: {
          email: 'demo@example.com',
          password: 'WrongPassword!'
        }
      });

      assert.equal(response.status, 401);
    }

    const response = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'WrongPassword!'
      }
    });

    assert.equal(response.status, 429);
    assert.equal(
      (response.body as { message: string }).message,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.login_rate_limited' &&
          candidate.details.requestId === response.headers.get('x-request-id')
      )
    );
  } finally {
    await context.close();
  }
});

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
