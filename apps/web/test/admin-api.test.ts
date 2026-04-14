import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK = 'false';

type CapturedRequest = {
  url: string;
  method: string | undefined;
  authorization: string | null;
  body: unknown;
};

test('admin API helpers call protected member and audit endpoints', async () => {
  const capturedRequests: CapturedRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    capturedRequests.push({
      url: String(input),
      method: init?.method,
      authorization: headers.get('Authorization'),
      body: rawBody ? (JSON.parse(rawBody) as unknown) : null
    });

    const url = new URL(String(input));
    const path = url.pathname;
    const responseBody = (() => {
      if (path.endsWith('/admin/members') && init?.method === 'GET') {
        return [];
      }

      if (path.endsWith('/admin/members/invitations')) {
        return {
          id: 'invitation-1',
          email: 'manager@example.com',
          role: 'MANAGER',
          expiresAt: '2026-04-21T00:00:00.000Z',
          acceptedAt: null,
          revokedAt: null,
          invitedByMembershipId: 'membership-1',
          createdAt: '2026-04-14T00:00:00.000Z'
        };
      }

      if (path.endsWith('/admin/members/membership-2/role')) {
        return buildMember({ role: 'EDITOR' });
      }

      if (path.endsWith('/admin/members/membership-2/status')) {
        return buildMember({ status: 'SUSPENDED' });
      }

      if (path.endsWith('/admin/members/membership-2')) {
        return null;
      }

      if (path.endsWith('/admin/audit-events')) {
        return {
          items: [],
          total: 0,
          offset: 0,
          limit: 50
        };
      }

      return null;
    })();

    const status = path.endsWith('/admin/members/membership-2') ? 204 : 200;

    return new Response(status === 204 ? null : JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const { setStoredAccessToken, clearStoredAccessToken } =
      await import('../src/shared/auth/auth-session-store');
    const {
      getAdminAuditEvents,
      getAdminMembers,
      inviteAdminMember,
      removeAdminMember,
      updateAdminMemberRole,
      updateAdminMemberStatus
    } = await import('../src/features/admin/admin.api');

    setStoredAccessToken('token-123');
    const fallbackMember = buildMember({});

    assert.deepEqual(await getAdminMembers(), []);
    assert.equal(
      (
        await inviteAdminMember({
          email: 'manager@example.com',
          role: 'MANAGER'
        })
      ).id,
      'invitation-1'
    );
    assert.equal(
      (
        await updateAdminMemberRole(
          'membership-2',
          { role: 'EDITOR' },
          fallbackMember
        )
      ).role,
      'EDITOR'
    );
    assert.equal(
      (
        await updateAdminMemberStatus(
          'membership-2',
          { status: 'SUSPENDED' },
          fallbackMember
        )
      ).status,
      'SUSPENDED'
    );
    assert.equal(await removeAdminMember('membership-2'), null);
    assert.deepEqual(
      await getAdminAuditEvents({
        action: 'admin_member.update_role',
        result: 'SUCCESS'
      }),
      {
        items: [],
        total: 0,
        offset: 0,
        limit: 50
      }
    );

    assert.deepEqual(
      capturedRequests.map((request) => ({
        url: request.url,
        method: request.method,
        authorization: request.authorization,
        body: request.body
      })),
      [
        {
          url: 'http://localhost:4000/api/admin/members',
          method: 'GET',
          authorization: 'Bearer token-123',
          body: null
        },
        {
          url: 'http://localhost:4000/api/admin/members/invitations',
          method: 'POST',
          authorization: 'Bearer token-123',
          body: {
            email: 'manager@example.com',
            role: 'MANAGER'
          }
        },
        {
          url: 'http://localhost:4000/api/admin/members/membership-2/role',
          method: 'PATCH',
          authorization: 'Bearer token-123',
          body: {
            role: 'EDITOR'
          }
        },
        {
          url: 'http://localhost:4000/api/admin/members/membership-2/status',
          method: 'PATCH',
          authorization: 'Bearer token-123',
          body: {
            status: 'SUSPENDED'
          }
        },
        {
          url: 'http://localhost:4000/api/admin/members/membership-2',
          method: 'DELETE',
          authorization: 'Bearer token-123',
          body: null
        },
        {
          url: 'http://localhost:4000/api/admin/audit-events?action=admin_member.update_role&result=SUCCESS',
          method: 'GET',
          authorization: 'Bearer token-123',
          body: null
        }
      ]
    );

    clearStoredAccessToken();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function buildMember(input: {
  role?: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
  status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
}) {
  return {
    id: 'membership-2',
    userId: 'user-2',
    email: 'manager@example.com',
    name: 'Manager User',
    role: input.role ?? 'MANAGER',
    status: input.status ?? 'ACTIVE',
    joinedAt: '2026-04-14T00:00:00.000Z',
    lastAccessAt: null,
    invitedByMembershipId: 'membership-1',
    emailVerified: true
  };
}
