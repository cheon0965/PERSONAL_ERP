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

test('POST /auth/register sends verification email and verified users can login', async () => {
  const context = await createRequestTestContext();

  try {
    const registerResponse = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'owner@example.com',
        password: 'Owner1234!',
        name: 'Owner User'
      }
    });

    assert.equal(registerResponse.status, 200);
    assert.deepEqual(registerResponse.body, {
      status: 'verification_sent'
    });
    assert.equal(
      readCookieValue(registerResponse.headers, 'refreshToken'),
      null
    );
    assert.equal(context.state.sentEmails.length, 1);
    assert.equal(context.state.sentEmails[0]?.to, 'owner@example.com');

    const createdUser = context.state.users.find(
      (candidate) => candidate.email === 'owner@example.com'
    );
    assert.ok(createdUser);
    assert.equal(createdUser.emailVerifiedAt, null);

    const wrongPasswordBeforeVerification = await context.request(
      '/auth/login',
      {
        method: 'POST',
        body: {
          email: 'owner@example.com',
          password: 'WrongPassword!'
        }
      }
    );

    assert.equal(wrongPasswordBeforeVerification.status, 401);
    assert.equal(
      (wrongPasswordBeforeVerification.body as { message: string }).message,
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );

    const loginBeforeVerification = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'owner@example.com',
        password: 'Owner1234!'
      }
    });

    assert.equal(loginBeforeVerification.status, 401);
    assert.equal(
      (loginBeforeVerification.body as { message: string }).message,
      '이메일 인증을 완료한 뒤 로그인해 주세요.'
    );

    const token = readEmailVerificationToken(context.state.sentEmails[0]?.text);
    const verifyResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token }
    });

    assert.equal(verifyResponse.status, 200);
    assert.deepEqual(verifyResponse.body, { status: 'verified' });
    const verifiedUser = context.state.users.find(
      (candidate) => candidate.id === createdUser.id
    );
    assert.ok(verifiedUser?.emailVerifiedAt);

    const createdMembership = context.state.memberships.find(
      (candidate) => candidate.userId === createdUser.id
    );
    assert.ok(createdMembership);
    assert.equal(createdMembership.role, 'OWNER');
    assert.equal(createdMembership.status, 'ACTIVE');

    const createdTenant = context.state.tenants.find(
      (candidate) => candidate.id === createdMembership.tenantId
    );
    assert.ok(createdTenant);
    assert.ok(createdTenant.defaultLedgerId);

    const createdLedger = context.state.ledgers.find(
      (candidate) => candidate.id === createdTenant.defaultLedgerId
    );
    assert.ok(createdLedger);
    assert.equal(
      context.state.accountSubjects.filter(
        (candidate) => candidate.ledgerId === createdLedger.id
      ).length,
      5
    );
    assert.equal(
      context.state.ledgerTransactionTypes.filter(
        (candidate) => candidate.ledgerId === createdLedger.id
      ).length,
      7
    );

    const loginAfterVerification = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'owner@example.com',
        password: 'Owner1234!'
      }
    });

    assert.equal(loginAfterVerification.status, 200);
    assert.match(
      (loginAfterVerification.body as { accessToken: string }).accessToken,
      /^test-access-token:[^:]+:user-3$/
    );
    assert.equal(
      readCookieValue(loginAfterVerification.headers, 'refreshToken')?.includes(
        'user-3'
      ),
      true
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.email_verified' &&
          candidate.details.userId === createdUser.id
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/register returns a generic response for an existing verified email', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Changed1234!',
        name: 'Changed User'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: 'verification_sent'
    });
    assert.equal(context.state.sentEmails.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /auth/register returns 403 for disallowed browser origins', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/register', {
      method: 'POST',
      headers: {
        origin: 'http://evil.example.com',
        referer: 'http://evil.example.com/register'
      },
      body: {
        email: 'owner@example.com',
        password: 'Owner1234!',
        name: 'Owner User'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      (response.body as { message: string }).message,
      'Origin not allowed'
    );
    assert.equal(context.state.sentEmails.length, 0);
  } finally {
    await context.close();
  }
});

test('POST /auth/verify-email rejects invalid, expired, and consumed tokens', async () => {
  const context = await createRequestTestContext();

  try {
    const invalidTokenResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: buildInvalidVerificationToken('initial') }
    });

    assert.equal(invalidTokenResponse.status, 400);
    assert.equal(
      (invalidTokenResponse.body as { message: string }).message,
      '이메일 인증 링크가 올바르지 않습니다.'
    );

    await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'expired-owner@example.com',
        password: 'Owner1234!',
        name: 'Expired Owner'
      }
    });
    const expiredToken = readEmailVerificationToken(
      context.state.sentEmails.at(-1)?.text
    );
    const expiredTokenRecord = context.state.emailVerificationTokens.at(-1);
    assert.ok(expiredTokenRecord);
    expiredTokenRecord.expiresAt = new Date('2000-01-01T00:00:00.000Z');

    const expiredTokenResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: expiredToken }
    });

    assert.equal(expiredTokenResponse.status, 400);
    assert.equal(
      (expiredTokenResponse.body as { message: string }).message,
      '이메일 인증 링크가 만료되었습니다. 다시 요청해 주세요.'
    );

    await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'consumed-owner@example.com',
        password: 'Owner1234!',
        name: 'Consumed Owner'
      }
    });
    const consumedToken = readEmailVerificationToken(
      context.state.sentEmails.at(-1)?.text
    );

    const firstVerifyResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: consumedToken }
    });
    const consumedTokenResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: consumedToken }
    });

    assert.equal(firstVerifyResponse.status, 200);
    assert.equal(consumedTokenResponse.status, 400);
    assert.equal(
      (consumedTokenResponse.body as { message: string }).message,
      '이미 사용한 이메일 인증 링크입니다.'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'warn' &&
          candidate.event === 'auth.email_verification_failed' &&
          candidate.details.reason === 'consumed_email_verification_token'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/resend-verification reissues tokens without leaking account state', async () => {
  const context = await createRequestTestContext();

  try {
    const registerResponse = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'resend-owner@example.com',
        password: 'Owner1234!',
        name: 'Resend Owner'
      }
    });

    assert.equal(registerResponse.status, 200);
    assert.equal(context.state.sentEmails.length, 1);
    const originalToken = readEmailVerificationToken(
      context.state.sentEmails[0]?.text
    );

    const blockedVerifyResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      headers: {
        origin: 'http://evil.example.com',
        referer: 'http://evil.example.com/verify-email'
      },
      body: { token: originalToken }
    });
    const blockedResendResponse = await context.request(
      '/auth/resend-verification',
      {
        method: 'POST',
        headers: {
          origin: 'http://evil.example.com',
          referer: 'http://evil.example.com/verify-email'
        },
        body: {
          email: 'resend-owner@example.com'
        }
      }
    );

    assert.equal(blockedVerifyResponse.status, 403);
    assert.equal(blockedResendResponse.status, 403);
    assert.equal(context.state.sentEmails.length, 1);

    const resendResponse = await context.request('/auth/resend-verification', {
      method: 'POST',
      body: {
        email: 'resend-owner@example.com'
      }
    });

    assert.equal(resendResponse.status, 200);
    assert.deepEqual(resendResponse.body, { status: 'verification_sent' });
    assert.equal(context.state.sentEmails.length, 2);
    const resentToken = readEmailVerificationToken(
      context.state.sentEmails[1]?.text
    );
    assert.notEqual(resentToken, originalToken);

    const originalTokenResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: originalToken }
    });
    const resentTokenResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: resentToken }
    });

    assert.equal(originalTokenResponse.status, 400);
    assert.equal(
      (originalTokenResponse.body as { message: string }).message,
      '이미 사용한 이메일 인증 링크입니다.'
    );
    assert.equal(resentTokenResponse.status, 200);
    assert.deepEqual(resentTokenResponse.body, { status: 'verified' });

    const verifiedResendResponse = await context.request(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: {
          email: 'resend-owner@example.com'
        }
      }
    );
    const unknownResendResponse = await context.request(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: {
          email: 'missing-owner@example.com'
        }
      }
    );

    assert.equal(verifiedResendResponse.status, 200);
    assert.equal(unknownResendResponse.status, 200);
    assert.deepEqual(verifiedResendResponse.body, {
      status: 'verification_sent'
    });
    assert.deepEqual(unknownResendResponse.body, {
      status: 'verification_sent'
    });
    assert.equal(context.state.sentEmails.length, 2);
  } finally {
    await context.close();
  }
});

test('auth registration email endpoints enforce rate limits', async () => {
  const context = await createRequestTestContext();

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await context.request('/auth/register', {
        method: 'POST',
        body: {
          email: 'rate-owner@example.com',
          password: 'Owner1234!',
          name: 'Rate Owner'
        }
      });

      assert.equal(response.status, 200);
    }

    const registerLimitResponse = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'rate-owner@example.com',
        password: 'Owner1234!',
        name: 'Rate Owner'
      }
    });

    assert.equal(registerLimitResponse.status, 429);
    assert.equal(
      (registerLimitResponse.body as { message: string }).message,
      '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await context.request('/auth/verify-email', {
        method: 'POST',
        body: { token: buildInvalidVerificationToken(String(attempt)) }
      });

      assert.equal(response.status, 400);
    }

    const verifyLimitResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token: buildInvalidVerificationToken('over-limit') }
    });

    assert.equal(verifyLimitResponse.status, 429);
    assert.equal(
      (verifyLimitResponse.body as { message: string }).message,
      '이메일 인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );

    await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'resend-rate-owner@example.com',
        password: 'Owner1234!',
        name: 'Resend Rate Owner'
      }
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await context.request('/auth/resend-verification', {
        method: 'POST',
        body: {
          email: 'resend-rate-owner@example.com'
        }
      });

      assert.equal(response.status, 200);
    }

    const resendLimitResponse = await context.request(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: {
          email: 'resend-rate-owner@example.com'
        }
      }
    );

    assert.equal(resendLimitResponse.status, 429);
    assert.equal(
      (resendLimitResponse.body as { message: string }).message,
      '인증 메일 재발송 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
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

function readEmailVerificationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

function buildInvalidVerificationToken(suffix: string): string {
  return `invalid-verification-token-${suffix}`.padEnd(40, 'x');
}

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

test('GET /auth/account-security returns profile, sessions, and recent events', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.authSessions.push({
      id: 'session-user-1-other',
      userId: 'user-1',
      refreshTokenHash: 'existing-session-hash-2',
      expiresAt: new Date('2026-04-01T00:00:00.000Z'),
      revokedAt: new Date('2026-03-20T00:00:00.000Z'),
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z')
    });

    const response = await context.request('/auth/account-security', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    const body = response.body as {
      profile: { email: string; preferredTimezone: string };
      sessions: Array<{ id: string; isCurrent: boolean }>;
      recentEvents: Array<{ kind: string }>;
    };
    assert.equal(body.profile.email, 'demo@example.com');
    assert.equal(body.profile.preferredTimezone, 'Asia/Seoul');
    assert.equal(
      body.sessions.some((session) => session.isCurrent),
      true
    );
    assert.equal(
      body.recentEvents.some((event) => event.kind === 'SESSION_CREATED'),
      true
    );
  } finally {
    await context.close();
  }
});

test('PATCH /auth/account-profile updates the current user name', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/account-profile', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        name: 'Updated Demo User'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(context.state.users[0]?.name, 'Updated Demo User');
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'account_profile.update' &&
          event.result === 'SUCCESS'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/change-password revokes other sessions and applies the new password', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.authSessions.unshift({
      id: 'session-user-1-secondary',
      userId: 'user-1',
      refreshTokenHash: 'secondary-hash',
      expiresAt: new Date('2026-04-01T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-15T00:00:00.000Z')
    });

    const response = await context.request('/auth/change-password', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        currentPassword: 'Demo1234!',
        nextPassword: 'NextDemo1234!'
      }
    });

    assert.equal(response.status, 201);
    assert.equal((response.body as { status: string }).status, 'changed');
    assert.equal(
      context.state.authSessions.filter(
        (candidate) =>
          candidate.userId === 'user-1' &&
          candidate.id !== 'session-user-1-secondary' &&
          candidate.revokedAt === null
      ).length,
      1
    );
    assert.ok(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1-secondary'
      )?.revokedAt
    );

    const oldPasswordResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'Demo1234!'
      }
    });
    assert.equal(oldPasswordResponse.status, 401);

    const newPasswordResponse = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@example.com',
        password: 'NextDemo1234!'
      }
    });
    assert.equal(newPasswordResponse.status, 200);
  } finally {
    await context.close();
  }
});

test('DELETE /auth/sessions/:sessionId revokes another active session', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.authSessions.unshift({
      id: 'session-user-1-secondary',
      userId: 'user-1',
      refreshTokenHash: 'secondary-hash',
      expiresAt: new Date('2026-04-01T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-15T00:00:00.000Z')
    });

    const response = await context.request(
      '/auth/sessions/session-user-1-secondary',
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.equal((response.body as { status: string }).status, 'revoked');
    assert.ok(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1-secondary'
      )?.revokedAt
    );
  } finally {
    await context.close();
  }
});
