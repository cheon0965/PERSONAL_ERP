import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequestTestContext,
  readCookieValue
} from '../../support/request-api/index';
import {
  REFRESH_COOKIE_NAME,
  buildInvalidVerificationToken,
  buildRegisterRequest,
  readEmailVerificationToken
} from './fixtures';

test('POST /auth/register sends verification email and verified users can login', async () => {
  const context = await createRequestTestContext();

  try {
    const registerResponse = await context.request('/auth/register', {
      method: 'POST',
      body: buildRegisterRequest({
        email: 'owner@example.com',
        password: 'Owner1234!',
        name: 'Owner User'
      })
    });

    assert.equal(registerResponse.status, 200);
    assert.deepEqual(registerResponse.body, {
      status: 'verification_sent'
    });
    assert.equal(
      readCookieValue(registerResponse.headers, REFRESH_COOKIE_NAME),
      null
    );
    assert.equal(context.state.sentEmails.length, 1);
    assert.equal(context.state.sentEmails[0]?.to, 'owner@example.com');
    assert.match(context.state.sentEmails[0]?.text ?? '', /30분 후에 만료/);

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
    assert.deepEqual(verifyResponse.body, {
      status: 'verified',
      email: 'owner@example.com'
    });
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
      readCookieValue(
        loginAfterVerification.headers,
        REFRESH_COOKIE_NAME
      )?.includes('user-3'),
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
      body: buildRegisterRequest({
        email: 'demo@example.com',
        password: 'Changed1234!',
        name: 'Changed User'
      })
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

test('POST /auth/register requires mandatory terms and privacy consent', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'missing-consent@example.com',
        password: 'Owner1234!',
        name: 'Missing Consent',
        termsAccepted: false,
        privacyConsentAccepted: false
      }
    });

    assert.equal(response.status, 400);
    const message = (response.body as { message: string[] }).message;
    assert.ok(message.includes('이용약관에 동의해 주세요.'));
    assert.ok(message.includes('개인정보 수집·이용에 동의해 주세요.'));
  } finally {
    await context.close();
  }
});

test('POST /auth/register rejects common passwords', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/register', {
      method: 'POST',
      body: buildRegisterRequest({
        email: 'weak-password@example.com',
        password: 'password123',
        name: 'Weak Password User'
      })
    });

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(response.body), /흔한 비밀번호/);
  } finally {
    await context.close();
  }
});

test('POST /auth/register allows long passphrases', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/register', {
      method: 'POST',
      body: buildRegisterRequest({
        email: 'long-passphrase@example.com',
        password:
          'correct-horse-battery-staple-2026-monthly-ledger-safety-passphrase',
        name: 'Strong Account User'
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: 'verification_sent'
    });
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
      body: buildRegisterRequest({
        email: 'owner@example.com',
        password: 'Owner1234!',
        name: 'Owner User'
      })
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
      body: buildRegisterRequest({
        email: 'expired-owner@example.com',
        password: 'Owner1234!',
        name: 'Expired Owner'
      })
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
      body: buildRegisterRequest({
        email: 'consumed-owner@example.com',
        password: 'Owner1234!',
        name: 'Consumed Owner'
      })
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
      body: buildRegisterRequest({
        email: 'resend-owner@example.com',
        password: 'Owner1234!',
        name: 'Resend Owner'
      })
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
    assert.deepEqual(resentTokenResponse.body, {
      status: 'verified',
      email: 'resend-owner@example.com'
    });

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
        body: buildRegisterRequest({
          email: 'rate-owner@example.com',
          password: 'Owner1234!',
          name: 'Rate Owner'
        })
      });

      assert.equal(response.status, 200);
    }

    const registerLimitResponse = await context.request('/auth/register', {
      method: 'POST',
      body: buildRegisterRequest({
        email: 'rate-owner@example.com',
        password: 'Owner1234!',
        name: 'Rate Owner'
      })
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
      body: buildRegisterRequest({
        email: 'resend-rate-owner@example.com',
        password: 'Owner1234!',
        name: 'Resend Rate Owner'
      })
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
