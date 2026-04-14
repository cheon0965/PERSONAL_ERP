import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /admin/members returns members only in the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.users.push({
      id: 'user-3',
      email: 'manager@example.com',
      name: 'Manager User',
      passwordHash: context.state.users[0]!.passwordHash,
      emailVerifiedAt: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      settings: {
        minimumReserveWon: 400_000,
        monthlySinkingFundWon: 140_000
      }
    });
    context.state.memberships.push({
      id: 'membership-3',
      tenantId: 'tenant-1',
      userId: 'user-3',
      role: 'MANAGER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-02T00:00:00.000Z'),
      invitedByMembershipId: 'membership-1',
      lastAccessAt: null
    });

    const response = await context.request('/admin/members', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      (response.body as Array<{ id: string; email: string }>).map((member) => ({
        id: member.id,
        email: member.email
      })),
      [
        {
          id: 'membership-1',
          email: 'demo@example.com'
        },
        {
          id: 'membership-3',
          email: 'manager@example.com'
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('POST /admin/members/invitations sends an invitation and records an audit event', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/admin/members/invitations', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        email: 'other@example.com',
        role: 'EDITOR'
      }
    });

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { email: string; role: string }).email,
      'other@example.com'
    );
    assert.equal(
      (response.body as { email: string; role: string }).role,
      'EDITOR'
    );
    assert.equal(context.state.sentEmails.length, 1);
    assert.equal(context.state.sentEmails[0]?.to, 'other@example.com');
    assert.match(
      context.state.sentEmails[0]?.text ?? '',
      /accept-invitation\?token=/
    );
    assert.equal(context.state.tenantMembershipInvitations.length, 1);
    assert.doesNotMatch(
      context.state.tenantMembershipInvitations[0]?.tokenHash ?? '',
      /accept-invitation/
    );
    assert.equal(
      context.state.memberships.some(
        (membership) =>
          membership.tenantId === 'tenant-1' &&
          membership.userId === 'user-2' &&
          membership.status === 'INVITED' &&
          membership.role === 'EDITOR'
      ),
      true
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'admin_member.invite' &&
          event.result === 'SUCCESS' &&
          event.resourceId === context.state.tenantMembershipInvitations[0]?.id
      ),
      true
    );

    const token = readInvitationToken(context.state.sentEmails[0]?.text);
    const acceptResponse = await context.request('/auth/accept-invitation', {
      method: 'POST',
      body: { token }
    });

    assert.equal(acceptResponse.status, 200);
    assert.deepEqual(acceptResponse.body, { status: 'accepted' });
    assert.equal(
      context.state.memberships.some(
        (membership) =>
          membership.tenantId === 'tenant-1' &&
          membership.userId === 'user-2' &&
          membership.status === 'ACTIVE' &&
          membership.role === 'EDITOR'
      ),
      true
    );
    assert.ok(context.state.tenantMembershipInvitations[0]?.acceptedAt);
  } finally {
    await context.close();
  }
});

function readInvitationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

test('PATCH /admin/members/:membershipId/role updates a member role and exposes the audit log', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.users.push({
      id: 'user-3',
      email: 'manager@example.com',
      name: 'Manager User',
      passwordHash: context.state.users[0]!.passwordHash,
      emailVerifiedAt: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z')
    });
    context.state.memberships.push({
      id: 'membership-3',
      tenantId: 'tenant-1',
      userId: 'user-3',
      role: 'MANAGER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-02T00:00:00.000Z'),
      invitedByMembershipId: 'membership-1',
      lastAccessAt: null
    });

    const updateResponse = await context.request(
      '/admin/members/membership-3/role',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          role: 'EDITOR'
        }
      }
    );

    assert.equal(updateResponse.status, 200);
    assert.equal(
      (updateResponse.body as { id: string; role: string }).role,
      'EDITOR'
    );
    assert.equal(
      context.state.memberships.find(
        (membership) => membership.id === 'membership-3'
      )?.role,
      'EDITOR'
    );

    const auditResponse = await context.request(
      '/admin/audit-events?action=admin_member.update_role',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(auditResponse.status, 200);
    const auditBody = auditResponse.body as {
      total: number;
      items: Array<{
        action: string;
        resourceId: string;
        result: string;
        metadata: Record<string, string>;
      }>;
    };
    assert.equal(auditBody.total, 1);
    assert.equal(auditBody.items[0]?.action, 'admin_member.update_role');
    assert.equal(auditBody.items[0]?.resourceId, 'membership-3');
    assert.equal(auditBody.items[0]?.result, 'SUCCESS');
    assert.deepEqual(auditBody.items[0]?.metadata, {
      previousRole: 'MANAGER',
      nextRole: 'EDITOR'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /admin/members/:membershipId/role blocks demoting the last active owner', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/admin/members/membership-1/role', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        role: 'MANAGER'
      }
    });

    assert.equal(response.status, 400);
    assert.equal(
      (response.body as { message: string }).message,
      '최소 1명의 활성 소유자가 남아 있어야 합니다.'
    );
    assert.equal(
      context.state.memberships.find(
        (membership) => membership.id === 'membership-1'
      )?.role,
      'OWNER'
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/audit-events records a denied event for non-owner users', async () => {
  const context = await createRequestTestContext();

  try {
    const ownerMembership = context.state.memberships.find(
      (membership) => membership.id === 'membership-1'
    );
    assert.ok(ownerMembership);
    ownerMembership.role = 'VIEWER';

    const response = await context.request('/admin/audit-events', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.eventName === 'authorization.action_denied' &&
          event.action === 'admin_audit_log.read' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});
