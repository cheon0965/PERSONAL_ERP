import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequestTestContext,
  readCookieValue,
  readSetCookieHeader
} from '../../support/request-api/index';
import { LEGACY_REFRESH_COOKIE_NAME, REFRESH_COOKIE_NAME } from './fixtures';

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
    assert.match(readSetCookieHeader(response.headers), /__Host-refreshToken=/);
    assert.match(readSetCookieHeader(response.headers), /Secure/i);
    assert.match(readSetCookieHeader(response.headers), /HttpOnly/i);
    assert.match(readSetCookieHeader(response.headers), /SameSite=Strict/i);
    assert.match(readSetCookieHeader(response.headers), /Path=\//i);
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
      REFRESH_COOKIE_NAME
    );

    assert.ok(originalRefreshToken);

    const response = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${originalRefreshToken}`
      }
    });

    const rotatedRefreshToken = readCookieValue(
      response.headers,
      REFRESH_COOKIE_NAME
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

test('POST /auth/refresh accepts the legacy refresh cookie name during migration', async () => {
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
      REFRESH_COOKIE_NAME
    );
    assert.ok(originalRefreshToken);

    const response = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `${LEGACY_REFRESH_COOKIE_NAME}=${originalRefreshToken}`
      }
    });

    const rotatedRefreshToken = readCookieValue(
      response.headers,
      REFRESH_COOKIE_NAME
    );
    assert.equal(response.status, 200);
    assert.ok(rotatedRefreshToken);
    assert.notEqual(rotatedRefreshToken, originalRefreshToken);
    assert.match(readSetCookieHeader(response.headers), /__Host-refreshToken=/);
    assert.match(readSetCookieHeader(response.headers), /Secure/i);
    assert.match(readSetCookieHeader(response.headers), /Path=\//i);
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
    const refreshToken = readCookieValue(
      loginResponse.headers,
      REFRESH_COOKIE_NAME
    );
    assert.ok(refreshToken);

    const logoutResponse = await context.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`
      }
    });

    assert.equal(logoutResponse.status, 200);
    assert.equal(
      (logoutResponse.body as { status: string }).status,
      'logged_out'
    );
    assert.match(
      readSetCookieHeader(logoutResponse.headers),
      /__Host-refreshToken=/
    );
    assert.match(readSetCookieHeader(logoutResponse.headers), /refreshToken=/);

    const refreshResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`
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
      REFRESH_COOKIE_NAME
    );
    assert.ok(originalRefreshToken);

    const rotatedResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${originalRefreshToken}`
      }
    });
    assert.equal(rotatedResponse.status, 200);

    const reuseResponse = await context.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${originalRefreshToken}`
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
