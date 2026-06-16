import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';

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
        email: 'demo@example.com',
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

test('POST /auth/change-password rejects passwords derived from service context', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/change-password', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        currentPassword: 'Demo1234!',
        nextPassword: 'personal-erp-2026!'
      }
    });

    assert.equal(response.status, 400);
    assert.match(
      JSON.stringify(response.body),
      /서비스명과 너무 비슷한 비밀번호/
    );
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
